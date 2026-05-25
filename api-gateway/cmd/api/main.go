package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/apidocs"
	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/auth"
	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/database"
	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/handlers"
	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/rabbitmq"
	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/storage"
	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/tenant"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/gorm"
)

func setupRouter(
	authHandler *handlers.AuthHandler,
	evalHandler *handlers.EvaluationHandler,
	questionHandler *handlers.QuestionHandler,
	db *gorm.DB,
) *gin.Engine {
	r := gin.Default()
	r.Use(corsMiddleware())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	r.GET("/docs", func(c *gin.Context) {
		var spec any
		if err := json.Unmarshal(apidocs.OpenAPISpec, &spec); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse OpenAPI spec"})
			return
		}
		c.JSON(http.StatusOK, spec)
	})

	registerRoutes(r.Group(""), authHandler, evalHandler, questionHandler, db)
	registerRoutes(r.Group("/api"), authHandler, evalHandler, questionHandler, db)

	return r
}

func registerRoutes(
	group *gin.RouterGroup,
	authHandler *handlers.AuthHandler,
	evalHandler *handlers.EvaluationHandler,
	questionHandler *handlers.QuestionHandler,
	db *gorm.DB,
) {
	authGroup := group.Group("/auth")
	{
		authGroup.POST("/register", authHandler.Register)
		authGroup.POST("/login", authHandler.Login)
		authGroup.POST("/refresh", authHandler.Refresh)
	}

	protected := group.Group("/")
	protected.Use(auth.Middleware(), tenant.Middleware(db))
	{
		protected.GET("/me", authHandler.Me)
		protected.POST("/evaluations", evalHandler.Create)
		protected.PUT("/evaluations/:id/upload", evalHandler.Upload)
		protected.POST("/evaluations/:id/complete", evalHandler.Complete)
		protected.GET("/evaluations/:id", evalHandler.GetByID)
		protected.GET("/evaluations", evalHandler.List)
		protected.GET("/evaluations/:id/stream", evalHandler.Stream)
		protected.GET("/questions", questionHandler.List)
	}
}

func corsMiddleware() gin.HandlerFunc {
	allowedOrigin := os.Getenv("CORS_ALLOW_ORIGIN")
	if allowedOrigin == "" {
		allowedOrigin = "http://localhost:5173"
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && (allowedOrigin == "*" || strings.EqualFold(origin, allowedOrigin)) {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
		}
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	db, err := database.Connect()
	if err != nil {
		log.Fatal("failed to connect to database:", err)
	}

	minioClient, err := storage.NewMinioClient()
	if err != nil {
		log.Fatal("failed to connect to minio:", err)
	}
	for i := 0; i < 10; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		err = minioClient.EnsureBucket(ctx)
		cancel()
		if err == nil {
			break
		}
		log.Printf("failed to ensure minio bucket (attempt %d/10): %v", i+1, err)
		time.Sleep(time.Duration(i+1) * time.Second)
	}
	if err != nil {
		log.Fatal("failed to ensure minio bucket after retries:", err)
	}

	mqClient, err := rabbitmq.NewClient()
	if err != nil {
		log.Fatal("failed to connect to rabbitmq:", err)
	}
	defer mqClient.Close()

	authService := auth.NewService(db)
	authHandler := handlers.NewAuthHandler(authService, db)
	evalHandler := handlers.NewEvaluationHandler(db, minioClient, mqClient)
	questionHandler := handlers.NewQuestionHandler(db)

	r := setupRouter(authHandler, evalHandler, questionHandler, db)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server running on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
