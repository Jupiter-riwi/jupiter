package e2e

import (
	"context"
	"testing"

	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/fanin"
	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/rabbitmq"
	"github.com/Jupiter-riwi/jupiter/api-gateway/pkg/models"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// mockPub records scoring jobs published during the test.
type mockPub struct {
	jobs []rabbitmq.JobMessage
	err  error
}

func (m *mockPub) PublishJob(_ context.Context, _ string, msg rabbitmq.JobMessage) error {
	if m.err != nil {
		return m.err
	}
	m.jobs = append(m.jobs, msg)
	return nil
}

func setupFaninDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Tenant{}, &models.User{}, &models.Evaluation{}, &models.Feature{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func newProcessingEval(t *testing.T, db *gorm.DB) models.Evaluation {
	t.Helper()
	tenant := models.Tenant{Name: "test-co", Domain: "test.co"}
	db.Create(&tenant)
	user := models.User{
		TenantID:     tenant.ID,
		Email:        "worker@test.co",
		PasswordHash: "hash",
		Role:         "user",
	}
	db.Create(&user)

	eval := models.Evaluation{
		TenantID: tenant.ID,
		UserID:   user.ID,
		Title:    "Fan-in E2E Test",
		VideoKey: "tenant/user/eval.mp4",
		Status:   models.StatusProcessing,
	}
	if err := db.Create(&eval).Error; err != nil {
		t.Fatalf("create eval: %v", err)
	}
	return eval
}

// TestE2E_FanIn_WorkersArrive_OneByOne simulates three workers finishing in
// sequence.  Scoring must fire only after the third worker saves its feature.
func TestE2E_FanIn_WorkersArriveOneByOne(t *testing.T) {
	db := setupFaninDB(t)
	eval := newProcessingEval(t, db)
	pub := &mockPub{}
	ctx := context.Background()

	// Worker 1 — pose finishes.
	if err := fanin.SaveFeature(ctx, db, eval.ID, models.FeatureKindPose, map[string]any{
		"posture_score":    0.88,
		"eye_contact_ratio": 0.72,
	}); err != nil {
		t.Fatalf("save pose: %v", err)
	}
	triggered, err := fanin.CheckAndTriggerScoring(ctx, db, pub, eval.ID)
	if err != nil || triggered {
		t.Errorf("after pose: triggered=%v err=%v (want false, nil)", triggered, err)
	}

	// Worker 2 — whisper finishes.
	if err := fanin.SaveFeature(ctx, db, eval.ID, models.FeatureKindTranscript, map[string]any{
		"word_count": 142,
	}); err != nil {
		t.Fatalf("save transcript: %v", err)
	}
	triggered, err = fanin.CheckAndTriggerScoring(ctx, db, pub, eval.ID)
	if err != nil || triggered {
		t.Errorf("after transcript: triggered=%v err=%v (want false, nil)", triggered, err)
	}

	// Worker 3 — prosody finishes.  This should trigger scoring.
	if err := fanin.SaveFeature(ctx, db, eval.ID, models.FeatureKindProsody, map[string]any{
		"pitch_mean_hz": 145.0,
	}); err != nil {
		t.Fatalf("save prosody: %v", err)
	}
	triggered, err = fanin.CheckAndTriggerScoring(ctx, db, pub, eval.ID)
	if err != nil {
		t.Fatalf("after prosody: unexpected error: %v", err)
	}
	if !triggered {
		t.Fatal("after prosody: expected scoring to be triggered")
	}
	if len(pub.jobs) != 1 {
		t.Fatalf("expected 1 scoring job, got %d", len(pub.jobs))
	}
	if pub.jobs[0].EvaluationID != eval.ID.String() {
		t.Errorf("scoring job evaluation_id mismatch")
	}

	// Evaluation status should now be "scoring".
	var updated models.Evaluation
	db.First(&updated, "id = ?", eval.ID)
	if updated.Status != "scoring" {
		t.Errorf("expected status=scoring, got %s", updated.Status)
	}
}

// TestE2E_FanIn_SimultaneousWorkers simulates two workers finishing at the same
// time.  The idempotency guard must ensure scoring fires exactly once.
func TestE2E_FanIn_SimultaneousWorkers(t *testing.T) {
	db := setupFaninDB(t)
	eval := newProcessingEval(t, db)
	pub := &mockPub{}
	ctx := context.Background()

	// Pre-save all three features (simulating concurrent writes).
	for _, kind := range models.AllFeatureKinds {
		fanin.SaveFeature(ctx, db, eval.ID, kind, map[string]any{"score": 0.8})
	}

	// Both worker goroutines call CheckAndTriggerScoring in rapid succession.
	triggered1, err1 := fanin.CheckAndTriggerScoring(ctx, db, pub, eval.ID)
	triggered2, err2 := fanin.CheckAndTriggerScoring(ctx, db, pub, eval.ID)

	if err1 != nil {
		t.Fatalf("call 1 error: %v", err1)
	}
	if err2 != nil {
		t.Fatalf("call 2 error: %v", err2)
	}

	triggeredCount := 0
	if triggered1 {
		triggeredCount++
	}
	if triggered2 {
		triggeredCount++
	}
	if triggeredCount != 1 {
		t.Errorf("expected exactly 1 trigger, got %d (triggered1=%v triggered2=%v)", triggeredCount, triggered1, triggered2)
	}
	if len(pub.jobs) != 1 {
		t.Errorf("expected exactly 1 published job, got %d", len(pub.jobs))
	}
}

// TestE2E_FanIn_WorkerFailure simulates a worker failure: scoring must NOT
// trigger and the evaluation must be marked as failed.
func TestE2E_FanIn_WorkerFailure(t *testing.T) {
	db := setupFaninDB(t)
	eval := newProcessingEval(t, db)
	pub := &mockPub{}
	ctx := context.Background()

	// pose and transcript succeed.
	fanin.SaveFeature(ctx, db, eval.ID, models.FeatureKindPose, map[string]any{"ok": true})
	fanin.SaveFeature(ctx, db, eval.ID, models.FeatureKindTranscript, map[string]any{"ok": true})

	// prosody worker fails — calls MarkFailed instead of SaveFeature.
	if err := fanin.MarkFailed(ctx, db, eval.ID, "prosody OOM"); err != nil {
		t.Fatalf("mark failed: %v", err)
	}

	// Even if CheckAndTriggerScoring is somehow called, it must not trigger.
	triggered, _ := fanin.CheckAndTriggerScoring(ctx, db, pub, eval.ID)
	if triggered {
		t.Error("scoring must not trigger when evaluation is in failed state")
	}
	if len(pub.jobs) != 0 {
		t.Errorf("expected 0 published jobs, got %d", len(pub.jobs))
	}

	// Evaluation must be marked failed with the error reason.
	var updated models.Evaluation
	db.First(&updated, "id = ?", eval.ID)
	if updated.Status != models.StatusFailed {
		t.Errorf("expected status=failed, got %s", updated.Status)
	}
}

// TestE2E_FanIn_SaveFeature_SameKindTwice verifies idempotency of SaveFeature:
// a retried worker write must not create duplicate rows or break the fan-in.
func TestE2E_FanIn_SaveFeatureSameKindTwice(t *testing.T) {
	db := setupFaninDB(t)
	eval := newProcessingEval(t, db)
	pub := &mockPub{}
	ctx := context.Background()

	// Pose worker retries (e.g., due to a transient NACK).
	for i := 0; i < 3; i++ {
		if err := fanin.SaveFeature(ctx, db, eval.ID, models.FeatureKindPose, map[string]any{"run": i}); err != nil {
			t.Fatalf("save pose attempt %d: %v", i, err)
		}
	}
	fanin.SaveFeature(ctx, db, eval.ID, models.FeatureKindTranscript, map[string]any{})
	fanin.SaveFeature(ctx, db, eval.ID, models.FeatureKindProsody, map[string]any{})

	triggered, err := fanin.CheckAndTriggerScoring(ctx, db, pub, eval.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !triggered {
		t.Error("expected scoring triggered after all three kinds present")
	}

	var count int64
	db.Model(&models.Feature{}).Where("evaluation_id = ? AND kind = ?", eval.ID, models.FeatureKindPose).Count(&count)
	if count != 1 {
		t.Errorf("expected exactly 1 pose feature row, got %d", count)
	}
}

// TestE2E_FanIn_InvalidEvaluation verifies that CheckAndTriggerScoring returns
// an error (not a panic) when the evaluation does not exist.
func TestE2E_FanIn_InvalidEvaluation(t *testing.T) {
	db := setupFaninDB(t)
	pub := &mockPub{}

	_, err := fanin.CheckAndTriggerScoring(context.Background(), db, pub, uuid.New())
	if err == nil {
		t.Error("expected error for non-existent evaluation")
	}
}
