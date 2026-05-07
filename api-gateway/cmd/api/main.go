package main

import (
	"log"
	"os"

	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/auth"
	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/database"
	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/handlers"
	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/tenant"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/gorm"
)

func setupRouter(authHandler *handlers.AuthHandler, db *gorm.DB) *gin.Engine {
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

	authService := auth.NewService(db)
	authHandler := handlers.NewAuthHandler(authService, db)

	r := setupRouter(authHandler, db)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server running on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
