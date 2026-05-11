package models

import (
	"time"

	"github.com/google/uuid"
)

type FeatureKind string

const (
	FeatureKindPose       FeatureKind = "pose"
	FeatureKindTranscript FeatureKind = "transcript"
	FeatureKindProsody    FeatureKind = "prosody"
)

// AllFeatureKinds lists the three kinds that must be present before scoring.
var AllFeatureKinds = []FeatureKind{FeatureKindPose, FeatureKindTranscript, FeatureKindProsody}

type Feature struct {
	ID           uuid.UUID   `gorm:"type:uuid;primaryKey"  json:"id"`
	EvaluationID uuid.UUID   `gorm:"type:uuid;not null;index:idx_feature_eval_kind,unique" json:"evaluation_id"`
	Kind         FeatureKind `gorm:"type:varchar(20);not null;index:idx_feature_eval_kind,unique" json:"kind"`
	Data         []byte      `gorm:"type:jsonb"            json:"data,omitempty"`
	CreatedAt    time.Time   `json:"created_at"`
}

func (f *Feature) BeforeCreate(_ interface{}) error {
	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	return nil
}
