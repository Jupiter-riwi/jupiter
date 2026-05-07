package fanin_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/fanin"
	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/rabbitmq"
	"github.com/Jupiter-riwi/jupiter/api-gateway/pkg/models"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// mockPublisher records published jobs and can be set to return an error.
type mockPublisher struct {
	published []rabbitmq.JobMessage
	err       error
}

func (m *mockPublisher) PublishJob(_ context.Context, queue string, msg rabbitmq.JobMessage) error {
	if m.err != nil {
		return m.err
	}
	msg.JobType = queue // store queue name for assertion
	m.published = append(m.published, msg)
	return nil
}

func setupDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Evaluation{}, &models.Feature{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func newEval(t *testing.T, db *gorm.DB, status models.EvaluationStatus) models.Evaluation {
	t.Helper()
	eval := models.Evaluation{
		ID:       uuid.New(),
		TenantID: uuid.New(),
		UserID:   uuid.New(),
		Title:    "test",
		VideoKey: "tenant/user/eval.mp4",
		Status:   status,
	}
	if err := db.Create(&eval).Error; err != nil {
		t.Fatalf("create eval: %v", err)
	}
	return eval
}

func saveFeature(t *testing.T, db *gorm.DB, evalID uuid.UUID, kind models.FeatureKind) {
	t.Helper()
	if err := fanin.SaveFeature(context.Background(), db, evalID, kind, map[string]any{"score": 0.9}); err != nil {
		t.Fatalf("save feature %s: %v", kind, err)
	}
}

// --- SaveFeature ---

func TestSaveFeature_InsertsRow(t *testing.T) {
	db := setupDB(t)
	eval := newEval(t, db, models.StatusProcessing)

	if err := fanin.SaveFeature(context.Background(), db, eval.ID, models.FeatureKindPose, map[string]any{"ok": true}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var count int64
	db.Model(&models.Feature{}).Where("evaluation_id = ?", eval.ID).Count(&count)
	if count != 1 {
		t.Errorf("expected 1 feature row, got %d", count)
	}
}

func TestSaveFeature_IsIdempotent(t *testing.T) {
	db := setupDB(t)
	eval := newEval(t, db, models.StatusProcessing)

	for i := 0; i < 3; i++ {
		if err := fanin.SaveFeature(context.Background(), db, eval.ID, models.FeatureKindPose, map[string]any{"run": i}); err != nil {
			t.Fatalf("call %d failed: %v", i, err)
		}
	}

	var count int64
	db.Model(&models.Feature{}).Where("evaluation_id = ?", eval.ID).Count(&count)
	if count != 1 {
		t.Errorf("expected 1 feature row after 3 upserts, got %d", count)
	}
}

// --- CheckAndTriggerScoring ---

func TestCheckAndTriggerScoring_NotTriggeredWithTwoFeatures(t *testing.T) {
	db := setupDB(t)
	eval := newEval(t, db, models.StatusProcessing)
	pub := &mockPublisher{}

	saveFeature(t, db, eval.ID, models.FeatureKindPose)
	saveFeature(t, db, eval.ID, models.FeatureKindTranscript)

	triggered, err := fanin.CheckAndTriggerScoring(context.Background(), db, pub, eval.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if triggered {
		t.Error("expected not triggered with only 2 features")
	}
	if len(pub.published) != 0 {
		t.Error("expected no published jobs")
	}
}

func TestCheckAndTriggerScoring_TriggersWhenAllThreePresent(t *testing.T) {
	db := setupDB(t)
	eval := newEval(t, db, models.StatusProcessing)
	pub := &mockPublisher{}

	saveFeature(t, db, eval.ID, models.FeatureKindPose)
	saveFeature(t, db, eval.ID, models.FeatureKindTranscript)
	saveFeature(t, db, eval.ID, models.FeatureKindProsody)

	triggered, err := fanin.CheckAndTriggerScoring(context.Background(), db, pub, eval.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !triggered {
		t.Error("expected triggered")
	}
	if len(pub.published) != 1 {
		t.Errorf("expected 1 published job, got %d", len(pub.published))
	}
	if pub.published[0].EvaluationID != eval.ID.String() {
		t.Errorf("wrong evaluation_id in published job: %s", pub.published[0].EvaluationID)
	}

	// Status should be updated to "scoring"
	var updated models.Evaluation
	db.First(&updated, "id = ?", eval.ID)
	if updated.Status != "scoring" {
		t.Errorf("expected status=scoring, got %s", updated.Status)
	}
}

func TestCheckAndTriggerScoring_IdempotentOnDoubleCall(t *testing.T) {
	db := setupDB(t)
	eval := newEval(t, db, models.StatusProcessing)
	pub := &mockPublisher{}

	saveFeature(t, db, eval.ID, models.FeatureKindPose)
	saveFeature(t, db, eval.ID, models.FeatureKindTranscript)
	saveFeature(t, db, eval.ID, models.FeatureKindProsody)

	fanin.CheckAndTriggerScoring(context.Background(), db, pub, eval.ID)
	triggered, err := fanin.CheckAndTriggerScoring(context.Background(), db, pub, eval.ID)

	if err != nil {
		t.Fatalf("second call error: %v", err)
	}
	if triggered {
		t.Error("second call should not trigger again")
	}
	if len(pub.published) != 1 {
		t.Errorf("expected exactly 1 published job total, got %d", len(pub.published))
	}
}

func TestCheckAndTriggerScoring_SkipsIfNotProcessing(t *testing.T) {
	db := setupDB(t)
	pub := &mockPublisher{}

	for _, status := range []models.EvaluationStatus{models.StatusCompleted, models.StatusFailed, models.StatusPending} {
		eval := newEval(t, db, status)
		saveFeature(t, db, eval.ID, models.FeatureKindPose)
		saveFeature(t, db, eval.ID, models.FeatureKindTranscript)
		saveFeature(t, db, eval.ID, models.FeatureKindProsody)

		triggered, err := fanin.CheckAndTriggerScoring(context.Background(), db, pub, eval.ID)
		if err != nil {
			t.Fatalf("status=%s: unexpected error: %v", status, err)
		}
		if triggered {
			t.Errorf("status=%s: should not trigger scoring", status)
		}
	}

	if len(pub.published) != 0 {
		t.Errorf("expected 0 published jobs for non-processing evals, got %d", len(pub.published))
	}
}

func TestCheckAndTriggerScoring_PropagatesBrokerError(t *testing.T) {
	db := setupDB(t)
	eval := newEval(t, db, models.StatusProcessing)
	pub := &mockPublisher{err: errors.New("broker unavailable")}

	saveFeature(t, db, eval.ID, models.FeatureKindPose)
	saveFeature(t, db, eval.ID, models.FeatureKindTranscript)
	saveFeature(t, db, eval.ID, models.FeatureKindProsody)

	_, err := fanin.CheckAndTriggerScoring(context.Background(), db, pub, eval.ID)
	if err == nil {
		t.Error("expected error when broker fails")
	}
}

// --- MarkFailed ---

func TestMarkFailed_SetsStatusToFailed(t *testing.T) {
	db := setupDB(t)
	eval := newEval(t, db, models.StatusProcessing)

	if err := fanin.MarkFailed(context.Background(), db, eval.ID, "pose model crashed"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var updated models.Evaluation
	db.First(&updated, "id = ?", eval.ID)
	if updated.Status != models.StatusFailed {
		t.Errorf("expected status=failed, got %s", updated.Status)
	}
}

func TestMarkFailed_DoesNotOverwriteCompleted(t *testing.T) {
	db := setupDB(t)
	eval := newEval(t, db, models.StatusCompleted)

	if err := fanin.MarkFailed(context.Background(), db, eval.ID, "late failure"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var updated models.Evaluation
	db.First(&updated, "id = ?", eval.ID)
	if updated.Status != models.StatusCompleted {
		t.Errorf("mark failed should not overwrite completed, got %s", updated.Status)
	}
}

func TestMarkFailed_ContainsErrorReason(t *testing.T) {
	db := setupDB(t)
	eval := newEval(t, db, models.StatusProcessing)
	reason := "whisper OOM"

	fanin.MarkFailed(context.Background(), db, eval.ID, reason)

	var updated models.Evaluation
	db.First(&updated, "id = ?", eval.ID)
	if updated.Features == nil {
		t.Fatal("expected features to contain error reason")
	}
	if !containsString(string(updated.Features), reason) {
		t.Errorf("features JSON %q does not contain reason %q", updated.Features, reason)
	}
}

func containsString(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(s) > 0 && containsAt(s, sub))
}

func containsAt(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

func init() {
	_ = time.RFC3339 // suppress unused import
}
