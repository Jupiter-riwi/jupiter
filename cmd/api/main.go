package main

import (
	"github.com/Jeskaai/jupiter-api-gateway/internal/database"
	"github.com/Jeskaai/jupiter-api-gateway/pkg/models"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()
	database.ConnectDatabase()
	database.DB.AutoMigrate(&models.User{})
	
}

