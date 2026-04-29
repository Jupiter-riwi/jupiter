package main

import (
	"github.com/Jeskaai/jupiter-api-gateway/internal/database"
	"github.com/Jeskaai/jupiter-api-gateway/pkg/models"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables from .env file
	godotenv.Load()

	// Initialize database connection
	database.ConnectDatabase()

	// Run auto-migration to create/update the User table
	database.DB.AutoMigrate(&models.User{})
}
