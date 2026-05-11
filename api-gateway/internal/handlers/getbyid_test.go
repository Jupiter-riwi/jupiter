package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/auth"
	"github.com/Jupiter-riwi/jupiter/api-gateway/pkg/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newGetByIDDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db.AutoMigrate(&models.Tenant{}, &models.User{}, &models.Evaluation{})
	return db
}

func makeGetByIDHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		evalID, ok := parseEvalID(c)
		if !ok {
			return
		}

		var eval models.Evaluation
		if err := db.Where("tenant_id = ?", c.MustGet("claims").(*auth.Claims).TenantID).
			First(&eval, "id = ?", evalID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "evaluation not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}

		c.JSON(http.StatusOK, buildEvaluationResponse(eval))
	}
}

func routerWithGetByID(tenantID uuid.UUID, db *gorm.DB) *gin.Engine {
	r := gin.New()
	r.GET("/evaluations/:id", func(c *gin.Context) {
		c.Set("claims", &auth.Claims{TenantID: tenantID, Type: "access"})
		c.Next()
	}, makeGetByIDHandler(db))
	return r
}

// --- Tests ---

func TestGetByID_Found_Pending(t *testing.T) {
	db := newGetByIDDB(t)
	tenantID := uuid.New()
	db.Create(&models.Tenant{ID: tenantID, Name: "co", Domain: "co.test"})
	eval := seedEval(t, db, tenantID, uuid.New(), models.StatusPending, "key.mp4")

	r := routerWithGetByID(tenantID, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/evaluations/"+eval.ID.String(), nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d — %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["id"] != eval.ID.String() {
		t.Errorf("expected id %s, got %v", eval.ID, resp["id"])
	}
	if resp["status"] != "pending" {
		t.Errorf("expected status pending, got %v", resp["status"])
	}
}

func TestGetByID_Completed_ReturnsScoreAndFeatures(t *testing.T) {
	db := newGetByIDDB(t)
	tenantID := uuid.New()
	db.Create(&models.Tenant{ID: tenantID, Name: "co2", Domain: "co2.test"})

	score := 87.5
	features := []byte(`{"pose_score":0.9,"fluency":0.8,"energy":0.75}`)
	eval := models.Evaluation{
		TenantID: tenantID,
		UserID:   uuid.New(),
		Title:    "Completed eval",
		Status:   models.StatusCompleted,
		VideoKey: "key.mp4",
		Score:    &score,
		Features: features,
	}
	db.Create(&eval)

	r := routerWithGetByID(tenantID, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/evaluations/"+eval.ID.String(), nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["score"] == nil {
		t.Error("expected score in response")
	}
	if resp["features"] == nil {
		t.Error("expected features in response")
	}

	featMap, ok := resp["features"].(map[string]interface{})
	if !ok {
		t.Fatal("features should be a JSON object")
	}
	if featMap["pose_score"] != 0.9 {
		t.Errorf("expected pose_score=0.9, got %v", featMap["pose_score"])
	}
}

func TestGetByID_Processing_NoFeatures(t *testing.T) {
	db := newGetByIDDB(t)
	tenantID := uuid.New()
	db.Create(&models.Tenant{ID: tenantID, Name: "co3", Domain: "co3.test"})
	eval := seedEval(t, db, tenantID, uuid.New(), models.StatusProcessing, "key.mp4")

	r := routerWithGetByID(tenantID, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/evaluations/"+eval.ID.String(), nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["features"] != nil {
		t.Errorf("expected features=nil when processing, got %v", resp["features"])
	}
}

func TestGetByID_NotFound_Returns404(t *testing.T) {
	db := newGetByIDDB(t)
	tenantID := uuid.New()

	r := routerWithGetByID(tenantID, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/evaluations/"+uuid.New().String(), nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestGetByID_InvalidUUID_Returns400(t *testing.T) {
	db := newGetByIDDB(t)
	tenantID := uuid.New()

	r := routerWithGetByID(tenantID, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/evaluations/bad-uuid", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestGetByID_TenantIsolation(t *testing.T) {
	db := newGetByIDDB(t)
	tenantA, tenantB := uuid.New(), uuid.New()
	db.Create(&models.Tenant{ID: tenantA, Name: "a", Domain: "a.co"})
	db.Create(&models.Tenant{ID: tenantB, Name: "b", Domain: "b.co"})

	// Eval belongs to tenant B
	eval := seedEval(t, db, tenantB, uuid.New(), models.StatusPending, "key.mp4")

	// Request authenticated as tenant A
	r := routerWithGetByID(tenantA, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/evaluations/"+eval.ID.String(), nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("tenant A should not see tenant B's eval, expected 404, got %d", w.Code)
	}
}

// --- buildEvaluationResponse unit tests ---

func TestBuildEvaluationResponse_CompletedParsesFeatures(t *testing.T) {
	score := 90.0
	eval := models.Evaluation{
		Status:   models.StatusCompleted,
		Score:    &score,
		Features: []byte(`{"key":"value"}`),
	}

	resp := buildEvaluationResponse(eval)
	if resp.Features == nil {
		t.Error("expected features to be parsed")
	}
}

func TestBuildEvaluationResponse_PendingNoFeatures(t *testing.T) {
	eval := models.Evaluation{
		Status:   models.StatusPending,
		Features: []byte(`{"key":"value"}`),
	}

	resp := buildEvaluationResponse(eval)
	if resp.Features != nil {
		t.Error("features should be nil when not completed")
	}
}

func TestBuildEvaluationResponse_InvalidFeaturesJSON(t *testing.T) {
	score := 80.0
	eval := models.Evaluation{
		Status:   models.StatusCompleted,
		Score:    &score,
		Features: []byte(`not-valid-json`),
	}

	resp := buildEvaluationResponse(eval)
	if resp.Features != nil {
		t.Error("invalid JSON features should result in nil features")
	}
}
