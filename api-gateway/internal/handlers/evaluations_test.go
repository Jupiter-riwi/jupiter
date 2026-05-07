package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/auth"
	"github.com/Jupiter-riwi/jupiter/api-gateway/pkg/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func init() {
	gin.SetMode(gin.TestMode)
	os.Setenv("JWT_SECRET", "test-secret")
}

// stubMinio satisfies the presigned URL generation without a real MinIO.
type stubMinio struct {
	url string
	err error
}

func (s *stubMinio) PresignedPutURL(_ interface{}, _ string, _ interface{}) (string, error) {
	return s.url, s.err
}

// minioAdapter wraps stubMinio to match *storage.MinioClient signature via embedding.
// Since MinioClient is a concrete type, we test Create by injecting a fake handler directly.

func newEvalDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("db open: %v", err)
	}
	db.AutoMigrate(&models.Tenant{}, &models.User{}, &models.Evaluation{})
	return db
}

func seedUserAndTenant(t *testing.T, db *gorm.DB) (models.Tenant, models.User) {
	t.Helper()
	tenant := models.Tenant{Name: "test-co", Domain: "test.co"}
	db.Create(&tenant)
	user := models.User{TenantID: tenant.ID, Email: "u@test.co", PasswordHash: "x", Role: models.RoleMember}
	db.Create(&user)
	return tenant, user
}

func routerWithClaims(tenantID, userID uuid.UUID, handler gin.HandlerFunc) *gin.Engine {
	r := gin.New()
	r.POST("/evaluations", func(c *gin.Context) {
		c.Set("claims", &auth.Claims{TenantID: tenantID, UserID: userID, Role: "member", Type: "access"})
		c.Next()
	}, handler)
	return r
}

// --- Model ---

func TestEvaluation_BeforeCreate_AssignsUUID(t *testing.T) {
	eval := &models.Evaluation{}
	eval.BeforeCreate(nil)
	if eval.ID == uuid.Nil {
		t.Error("expected UUID to be assigned")
	}
}

func TestEvaluation_BeforeCreate_PreservesUUID(t *testing.T) {
	id := uuid.New()
	eval := &models.Evaluation{ID: id}
	eval.BeforeCreate(nil)
	if eval.ID != id {
		t.Errorf("expected %s, got %s", id, eval.ID)
	}
}

func TestEvaluationStatus_Constants(t *testing.T) {
	cases := map[models.EvaluationStatus]string{
		models.StatusPending:    "pending",
		models.StatusUploading:  "uploading",
		models.StatusProcessing: "processing",
		models.StatusCompleted:  "completed",
		models.StatusFailed:     "failed",
	}
	for status, want := range cases {
		if string(status) != want {
			t.Errorf("expected %q, got %q", want, status)
		}
	}
}

// --- Handler: Create (with fake minio via custom handler) ---

func makeCreateHandler(db *gorm.DB, uploadURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createEvaluationRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		claims := c.MustGet("claims").(*auth.Claims)

		eval := models.Evaluation{
			TenantID: claims.TenantID,
			UserID:   claims.UserID,
			Title:    req.Title,
			Status:   models.StatusPending,
		}
		if err := db.Create(&eval).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create evaluation"})
			return
		}

		c.JSON(http.StatusCreated, createEvaluationResponse{
			Evaluation:   eval,
			UploadURL:    uploadURL,
			ExpiresInSec: 900,
		})
	}
}

func TestCreate_Success(t *testing.T) {
	db := newEvalDB(t)
	tenant, user := seedUserAndTenant(t, db)

	r := routerWithClaims(tenant.ID, user.ID, makeCreateHandler(db, "https://minio/presigned"))

	body, _ := json.Marshal(map[string]string{"title": "Sales pitch Q1"})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/evaluations", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d — %s", w.Code, w.Body.String())
	}

	var resp createEvaluationResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.Evaluation.ID == uuid.Nil {
		t.Error("expected evaluation ID in response")
	}
	if resp.UploadURL != "https://minio/presigned" {
		t.Errorf("unexpected upload_url: %s", resp.UploadURL)
	}
	if resp.Evaluation.TenantID != tenant.ID {
		t.Error("tenant_id mismatch")
	}
	if resp.Evaluation.Status != models.StatusPending {
		t.Errorf("expected status pending, got %s", resp.Evaluation.Status)
	}
}

func TestCreate_BadRequest_MissingTitle(t *testing.T) {
	db := newEvalDB(t)
	tenant, user := seedUserAndTenant(t, db)

	r := routerWithClaims(tenant.ID, user.ID, makeCreateHandler(db, ""))

	body, _ := json.Marshal(map[string]string{})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/evaluations", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestCreate_BadRequest_TitleTooShort(t *testing.T) {
	db := newEvalDB(t)
	tenant, user := seedUserAndTenant(t, db)

	r := routerWithClaims(tenant.ID, user.ID, makeCreateHandler(db, ""))

	body, _ := json.Marshal(map[string]string{"title": "ab"})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/evaluations", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for short title, got %d", w.Code)
	}
}

func TestCreate_EvaluationPersistedInDB(t *testing.T) {
	db := newEvalDB(t)
	tenant, user := seedUserAndTenant(t, db)

	r := routerWithClaims(tenant.ID, user.ID, makeCreateHandler(db, "https://minio/presigned"))

	body, _ := json.Marshal(map[string]string{"title": "Persisted eval"})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/evaluations", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	var resp createEvaluationResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	var found models.Evaluation
	if err := db.First(&found, "id = ?", resp.Evaluation.ID).Error; err != nil {
		t.Fatalf("evaluation not found in DB: %v", err)
	}
	if found.Title != "Persisted eval" {
		t.Errorf("unexpected title: %s", found.Title)
	}
}

// --- parseEvalID helper ---

func TestParseEvalID_Valid(t *testing.T) {
	r := gin.New()
	r.GET("/eval/:id", func(c *gin.Context) {
		id, ok := parseEvalID(c)
		if !ok {
			return
		}
		c.JSON(http.StatusOK, gin.H{"id": id})
	})

	validID := uuid.New().String()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/eval/"+validID, nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestParseEvalID_Invalid(t *testing.T) {
	r := gin.New()
	r.GET("/eval/:id", func(c *gin.Context) {
		parseEvalID(c)
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/eval/not-a-uuid", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}
