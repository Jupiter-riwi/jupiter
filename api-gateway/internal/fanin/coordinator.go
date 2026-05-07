// Package fanin implements the fan-in coordinator that fires the scoring job
// when all three feature workers (pose, whisper, prosody) have persisted their
// results for a given evaluation.
//
// The mechanism uses PostgreSQL as the atomic counter:
//
//  1. A worker saves its feature row (UPSERT with unique index on evaluation_id + kind).
//  2. The worker calls CheckAndTriggerScoring.
//  3. CheckAndTriggerScoring opens a transaction, locks the evaluation row with
//     SELECT FOR UPDATE, counts distinct feature kinds, and — if all three are
//     present and the evaluation is still "processing" — publishes to
//     jupiter.scoring and transitions the status to "scoring".
//
// The SELECT FOR UPDATE prevents two workers that finish simultaneously from
// both publishing the scoring job.
package fanin

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/rabbitmq"
	"github.com/Jupiter-riwi/jupiter/api-gateway/pkg/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Publisher is the subset of rabbitmq.Client that the coordinator needs.
// Using an interface makes the coordinator unit-testable without a live broker.
type Publisher interface {
	PublishJob(ctx context.Context, queue string, msg rabbitmq.JobMessage) error
}

// ScoringMessage is published to jupiter.scoring when all features are ready.
type ScoringMessage struct {
	EvaluationID string `json:"evaluation_id"`
	TenantID     string `json:"tenant_id"`
	IssuedAt     string `json:"issued_at"`
}

// SaveFeature persists (or upserts) a feature row for the evaluation.
// The unique index on (evaluation_id, kind) makes this idempotent; a second
// call from the same worker simply updates the data.
func SaveFeature(ctx context.Context, db *gorm.DB, evalID uuid.UUID, kind models.FeatureKind, data any) error {
	raw, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("fanin: marshal feature data: %w", err)
	}

	feature := models.Feature{
		EvaluationID: evalID,
		Kind:         kind,
		Data:         raw,
	}

	return db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "evaluation_id"}, {Name: "kind"}},
			DoUpdates: clause.AssignmentColumns([]string{"data"}),
		}).
		Create(&feature).Error
}

// CheckAndTriggerScoring checks whether all three feature kinds are present for
// the evaluation and, if so, publishes a scoring job exactly once.
//
// Returns (true, nil) when the scoring job was published.
// Returns (false, nil) when not all features are ready yet (or already triggered).
// Returns (false, err) on any database or broker error.
func CheckAndTriggerScoring(
	ctx context.Context,
	db *gorm.DB,
	pub Publisher,
	evalID uuid.UUID,
) (triggered bool, err error) {
	err = db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Lock the evaluation row to serialise concurrent workers.
		var eval models.Evaluation
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&eval, "id = ?", evalID).Error; err != nil {
			return fmt.Errorf("fanin: lock evaluation: %w", err)
		}

		// Only trigger from "processing" — avoids double-publish if two workers race.
		if eval.Status != models.StatusProcessing {
			return nil
		}

		// Count how many distinct feature kinds exist.
		var count int64
		if err := tx.Model(&models.Feature{}).
			Where("evaluation_id = ? AND kind IN ?", evalID, models.AllFeatureKinds).
			Distinct("kind").
			Count(&count).Error; err != nil {
			return fmt.Errorf("fanin: count features: %w", err)
		}

		if count < int64(len(models.AllFeatureKinds)) {
			// Not all features are ready yet.
			return nil
		}

		// Transition status to "scoring" before publishing so any subsequent
		// call skips the publish (idempotent guard above).
		if err := tx.Model(&eval).Update("status", "scoring").Error; err != nil {
			return fmt.Errorf("fanin: update status to scoring: %w", err)
		}

		msg := rabbitmq.JobMessage{
			EvaluationID: evalID.String(),
			TenantID:     eval.TenantID.String(),
			VideoKey:     eval.VideoKey,
			JobType:      "scoring",
			IssuedAt:     time.Now().UTC().Format(time.RFC3339),
		}

		if err := pub.PublishJob(ctx, rabbitmq.QueueScoring, msg); err != nil {
			return fmt.Errorf("fanin: publish scoring job: %w", err)
		}

		triggered = true
		return nil
	})

	return triggered, err
}

// MarkFailed sets the evaluation status to "failed" and records the error
// reason. Workers call this when they cannot process the job.
func MarkFailed(ctx context.Context, db *gorm.DB, evalID uuid.UUID, reason string) error {
	result := db.WithContext(ctx).
		Model(&models.Evaluation{}).
		Where("id = ? AND status NOT IN ?", evalID, []string{"completed", "failed"}).
		Updates(map[string]any{
			"status":   models.StatusFailed,
			"features": []byte(fmt.Sprintf(`{"error":%q}`, reason)),
		})

	if result.Error != nil {
		return fmt.Errorf("fanin: mark failed: %w", result.Error)
	}
	return nil
}
