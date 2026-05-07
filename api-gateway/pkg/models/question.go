package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Question struct {
	ID               uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	TenantID         uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	Text             string         `gorm:"type:text;not null" json:"text"`
	Category         string         `gorm:"type:varchar(100);not null" json:"category"`
	ExpectedDuration int            `gorm:"column:expected_duration_sec;not null" json:"expected_duration_sec"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

func (q *Question) BeforeCreate(tx *gorm.DB) error {
	if q.ID == uuid.Nil {
		q.ID = uuid.New()
	}
	return nil
}
