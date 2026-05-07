package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type EvaluationStatus string

const (
	StatusPending    EvaluationStatus = "pending"
	StatusUploading  EvaluationStatus = "uploading"
	StatusProcessing EvaluationStatus = "processing"
	StatusCompleted  EvaluationStatus = "completed"
	StatusFailed     EvaluationStatus = "failed"
)

type Evaluation struct {
	ID        uuid.UUID        `gorm:"type:uuid;primaryKey" json:"id"`
	TenantID  uuid.UUID        `gorm:"type:uuid;not null;index" json:"tenant_id"`
	UserID    uuid.UUID        `gorm:"type:uuid;not null;index" json:"user_id"`
	Title     string           `gorm:"not null" json:"title"`
	VideoKey  string           `gorm:"index" json:"video_key"`
	Status    EvaluationStatus `gorm:"type:varchar(20);not null;default:'pending'" json:"status"`
	Score     *float64         `json:"score"`
	Features  []byte           `gorm:"type:jsonb" json:"features,omitempty"`
	CreatedAt time.Time        `json:"created_at"`
	UpdatedAt time.Time        `json:"updated_at"`
	DeletedAt gorm.DeletedAt   `gorm:"index" json:"-"`
}

func (e *Evaluation) BeforeCreate(tx *gorm.DB) error {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return nil
}
