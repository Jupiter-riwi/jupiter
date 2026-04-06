package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID            uuid.UUID `gorm:"type:uuid;default:uuid_generate_v4();primaryKey"`
	RoleID        int       `gorm:"default:2"`
	Email         string    `gorm:"size:150;unique;not null"`
	PasswordHash  string    `gorm:"size:255;not null"`
	FirstName     string    `gorm:"size:100"`
	LastName      string    `gorm:"size:100"`
	IsStaffMaster bool      `gorm:"default:false"`
	CreatedAt     time.Time `gorm:"autoCreateTime"`
}