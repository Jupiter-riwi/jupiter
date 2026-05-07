package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/auth"
	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/rabbitmq"
	"github.com/Jupiter-riwi/jupiter/api-gateway/pkg/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type stubMQ struct {
	published []rabbitmq.JobMessage
	err       error
}

func (s *stubMQ) PublishJob(_ context.Context, _ string, msg rabbitmq.JobMessage) error {
	if s.err != nil {
		return s.err
	}
	s.published = append(s.published, msg)
	return nil
}

func newCompleteDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db.AutoMigrate(&models.Tenant{}, &models.User{}, &models.Evaluation{})
	return db
}

// makeCompleteHandler builds a slim version of Complete that uses a stub MQ.
func makeCompleteHandler(db *gorm.DB, mq *stubMQ) gin.HandlerFunc {
	return func(c *gin.Context) {
		evalID, ok := parseEvalID(c)
		if !ok {
			return
		}

		claims := c.MustGet("claims").(*auth.Claims)

		var eval models.Evaluation
		if err := db.Where("tenant_id = ?", claims.TenantID).First(&eval, "id = ? AND user_id = ?", evalID, claims.UserID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "evaluation not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}

		if eval.Status == models.StatusProcessing || eval.Status == models.StatusCompleted {
			c.JSON(http.StatusConflict, gin.H{"error": "evaluation already processing or completed"})
			return
		}

		if eval.VideoKey == "" {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "video not uploaded yet"})
			return
		}

		msg := rabbitmq.JobMessage{
			EvaluationID: eval.ID.String(),
			TenantID:     eval.TenantID.String(),
			VideoKey:     eval.VideoKey,
		}
		for _, j := range []struct{ q, t string }{
			{rabbitmq.QueuePose, "pose"},
			{rabbitmq.QueueWhisper, "whisper"},
			{rabbitmq.QueueProsody, "prosody"},
		} {
			msg.JobType = j.t
			if err := mq.PublishJob(c.Request.Context(), j.q, msg); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to publish jobs"})
				return
			}
		}

		db.Model(&eval).Update("status", models.StatusProcessing)
		eval.Status = models.StatusProcessing
		c.JSON(http.StatusAccepted, eval)
	}
}

func routerWithCompleteHandler(tenantID, userID uuid.UUID, db *gorm.DB, mq *stubMQ) *gin.Engine {
	r := gin.New()
	r.POST("/evaluations/:id/complete", func(c *gin.Context) {
		c.Set("claims", &auth.Claims{TenantID: tenantID, UserID: userID, Type: "access"})
		c.Next()
	}, makeCompleteHandler(db, mq))
	return r
}

func seedEval(t *testing.T, db *gorm.DB, tenantID, userID uuid.UUID, status models.EvaluationStatus, videoKey string) models.Evaluation {
	t.Helper()
	eval := models.Evaluation{
		TenantID: tenantID,
		UserID:   userID,
		Title:    "Test eval",
		Status:   status,
		VideoKey: videoKey,
	}
	db.Create(&eval)
	return eval
}

func TestComplete_Success_PublishesThreeJobs(t *testing.T) {
	db := newCompleteDB(t)
	tenantID, userID := uuid.New(), uuid.New()

	// Seed tenant so FK passes
	db.Create(&models.Tenant{ID: tenantID, Name: "t", Domain: "t.co"})
	eval := seedEval(t, db, tenantID, userID, models.StatusPending, "tenant/user/eval.mp4")

	mq := &stubMQ{}
	r := routerWithCompleteHandler(tenantID, userID, db, mq)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/evaluations/"+eval.ID.String()+"/complete", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d — %s", w.Code, w.Body.String())
	}

	if len(mq.published) != 3 {
		t.Fatalf("expected 3 jobs published, got %d", len(mq.published))
	}

	types := map[string]bool{}
	for _, msg := range mq.published {
		types[msg.JobType] = true
		if msg.EvaluationID != eval.ID.String() {
			t.Errorf("job evaluation_id mismatch: %s", msg.EvaluationID)
		}
		if msg.VideoKey != eval.VideoKey {
			t.Errorf("job video_key mismatch: %s", msg.VideoKey)
		}
	}

	for _, jt := range []string{"pose", "whisper", "prosody"} {
		if !types[jt] {
			t.Errorf("missing job type: %s", jt)
		}
	}
}

func TestComplete_StatusUpdatedToProcessing(t *testing.T) {
	db := newCompleteDB(t)
	tenantID, userID := uuid.New(), uuid.New()
	db.Create(&models.Tenant{ID: tenantID, Name: "t2", Domain: "t2.co"})
	eval := seedEval(t, db, tenantID, userID, models.StatusPending, "key.mp4")

	r := routerWithCompleteHandler(tenantID, userID, db, &stubMQ{})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/evaluations/"+eval.ID.String()+"/complete", nil)
	r.ServeHTTP(w, req)

	var updated models.Evaluation
	db.First(&updated, "id = ?", eval.ID)
	if updated.Status != models.StatusProcessing {
		t.Errorf("expected status processing, got %s", updated.Status)
	}
}

func TestComplete_AlreadyProcessing_Returns409(t *testing.T) {
	db := newCompleteDB(t)
	tenantID, userID := uuid.New(), uuid.New()
	db.Create(&models.Tenant{ID: tenantID, Name: "t3", Domain: "t3.co"})
	eval := seedEval(t, db, tenantID, userID, models.StatusProcessing, "key.mp4")

	r := routerWithCompleteHandler(tenantID, userID, db, &stubMQ{})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/evaluations/"+eval.ID.String()+"/complete", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Errorf("expected 409, got %d", w.Code)
	}
}

func TestComplete_NoVideoKey_Returns422(t *testing.T) {
	db := newCompleteDB(t)
	tenantID, userID := uuid.New(), uuid.New()
	db.Create(&models.Tenant{ID: tenantID, Name: "t4", Domain: "t4.co"})
	eval := seedEval(t, db, tenantID, userID, models.StatusPending, "") // no video key

	r := routerWithCompleteHandler(tenantID, userID, db, &stubMQ{})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/evaluations/"+eval.ID.String()+"/complete", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("expected 422, got %d", w.Code)
	}
}

func TestComplete_EvalNotFound_Returns404(t *testing.T) {
	db := newCompleteDB(t)
	tenantID, userID := uuid.New(), uuid.New()

	r := routerWithCompleteHandler(tenantID, userID, db, &stubMQ{})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/evaluations/"+uuid.New().String()+"/complete", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestComplete_MQFailure_Returns500(t *testing.T) {
	db := newCompleteDB(t)
	tenantID, userID := uuid.New(), uuid.New()
	db.Create(&models.Tenant{ID: tenantID, Name: "t5", Domain: "t5.co"})
	eval := seedEval(t, db, tenantID, userID, models.StatusPending, "key.mp4")

	mq := &stubMQ{err: errors.New("broker down")}
	r := routerWithCompleteHandler(tenantID, userID, db, mq)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/evaluations/"+eval.ID.String()+"/complete", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

func TestComplete_InvalidID_Returns400(t *testing.T) {
	db := newCompleteDB(t)
	tenantID, userID := uuid.New(), uuid.New()

	r := routerWithCompleteHandler(tenantID, userID, db, &stubMQ{})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/evaluations/not-a-uuid/complete", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestComplete_ResponseContainsEvaluation(t *testing.T) {
	db := newCompleteDB(t)
	tenantID, userID := uuid.New(), uuid.New()
	db.Create(&models.Tenant{ID: tenantID, Name: "t6", Domain: "t6.co"})
	eval := seedEval(t, db, tenantID, userID, models.StatusPending, "key.mp4")

	r := routerWithCompleteHandler(tenantID, userID, db, &stubMQ{})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/evaluations/"+eval.ID.String()+"/complete", nil)
	r.ServeHTTP(w, req)

	var resp models.Evaluation
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.ID != eval.ID {
		t.Errorf("expected evaluation id %s, got %s", eval.ID, resp.ID)
	}
	if resp.Status != models.StatusProcessing {
		t.Errorf("expected status processing in response, got %s", resp.Status)
	}
}
