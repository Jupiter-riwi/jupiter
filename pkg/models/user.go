package models

import (
	"time"

	"github.com/google/uuid"
)

// User represents the users table in the database
type User struct {
	// Primary key using UUID
	ID uuid.UUID `gorm:"type:uuid;default:uuid_generate_v4();primaryKey"`

	// Role identifier (default: 2 - standard user)
	RoleID int `gorm:"default:2"`

	// User email (must be unique and not null)
	Email string `gorm:"size:150;unique;not null"`

	// Hashed password for security
	PasswordHash string `gorm:"size:255;not null"`

	// User first name
	FirstName string `gorm:"size:100"`

	// User last name
	LastName string `gorm:"size:100"`

	// Indicates if the user has master staff privileges
	IsStaffMaster bool `gorm:"default:false"`

	// Timestamp when the user was created
	CreatedAt time.Time `gorm:"autoCreateTime"`
}