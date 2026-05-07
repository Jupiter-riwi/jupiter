package main

import (
	"log"
	"os"

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
	db *gorm.DB,
) *gin.Engine {
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	authGroup := r.Group("/auth")
	{
		authGroup.POST("/register", authHandler.Register)
		authGroup.POST("/login", authHandler.Login)
		authGroup.POST("/refresh", authHandler.Refresh)
	}

	protected := r.Group("/")
	protected.Use(auth.Middleware(), tenant.Middleware(db))
	{
		protected.GET("/me", authHandler.Me)

		protected.POST("/evaluations", evalHandler.Create)
		protected.POST("/evaluations/:id/complete", evalHandler.Complete)
		protected.GET("/evaluations/:id", evalHandler.GetByID)
		protected.GET("/evaluations", evalHandler.List)
		protected.GET("/evaluations/:id/stream", evalHandler.Stream)
	}

	return r
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

	mqClient, err := rabbitmq.NewClient()
	if err != nil {
		log.Fatal("failed to connect to rabbitmq:", err)
	}
	defer mqClient.Close()

	authService := auth.NewService(db)
	authHandler := handlers.NewAuthHandler(authService, db)
	evalHandler := handlers.NewEvaluationHandler(db, minioClient, mqClient)

	r := setupRouter(authHandler, evalHandler, db)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server running on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
