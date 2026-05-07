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

func newQuestionsDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db.AutoMigrate(&models.Tenant{}, &models.Question{})
	return db
}

func routerWithQuestions(tenantID uuid.UUID, db *gorm.DB) *gin.Engine {
	r := gin.New()
	r.GET("/questions", func(c *gin.Context) {
		c.Set("claims", &auth.Claims{TenantID: tenantID, Type: "access"})
		// inject scoped DB manually (simulates tenant middleware)
		c.Set("tenant_db", db.Where("tenant_id = ?", tenantID))
		c.Next()
	}, NewQuestionHandler(db).List)
	return r
}

func seedQuestions(t *testing.T, db *gorm.DB, tenantID uuid.UUID, questions []models.Question) {
	t.Helper()
	for i := range questions {
		questions[i].TenantID = tenantID
		db.Create(&questions[i])
	}
}

// --- Tests ---

func TestQuestionsList_Empty(t *testing.T) {
	db := newQuestionsDB(t)
	tenantID := uuid.New()

	r := routerWithQuestions(tenantID, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/questions", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["total"].(float64) != 0 {
		t.Errorf("expected total=0, got %v", resp["total"])
	}
}

func TestQuestionsList_ReturnsAllFields(t *testing.T) {
	db := newQuestionsDB(t)
	tenantID := uuid.New()

	seedQuestions(t, db, tenantID, []models.Question{
		{Text: "What is your value proposition?", Category: "sales", ExpectedDuration: 90},
	})

	r := routerWithQuestions(tenantID, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/questions", nil)
	r.ServeHTTP(w, req)

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	data := resp["data"].([]interface{})
	if len(data) != 1 {
		t.Fatalf("expected 1 question, got %d", len(data))
	}

	q := data[0].(map[string]interface{})
	if q["text"] != "What is your value proposition?" {
		t.Errorf("unexpected text: %v", q["text"])
	}
	if q["category"] != "sales" {
		t.Errorf("unexpected category: %v", q["category"])
	}
	if q["expected_duration_sec"].(float64) != 90 {
		t.Errorf("unexpected expected_duration_sec: %v", q["expected_duration_sec"])
	}
	if q["tenant_id"] == nil {
		t.Error("expected tenant_id in response")
	}
}

func TestQuestionsList_FilterByCategory(t *testing.T) {
	db := newQuestionsDB(t)
	tenantID := uuid.New()

	seedQuestions(t, db, tenantID, []models.Question{
		{Text: "Q1", Category: "sales", ExpectedDuration: 60},
		{Text: "Q2", Category: "sales", ExpectedDuration: 90},
		{Text: "Q3", Category: "product", ExpectedDuration: 120},
	})

	r := routerWithQuestions(tenantID, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/questions?category=sales", nil)
	r.ServeHTTP(w, req)

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["total"].(float64) != 2 {
		t.Errorf("expected total=2 for sales, got %v", resp["total"])
	}

	for _, item := range resp["data"].([]interface{}) {
		q := item.(map[string]interface{})
		if q["category"] != "sales" {
			t.Errorf("expected category=sales, got %v", q["category"])
		}
	}
}

func TestQuestionsList_TenantIsolation(t *testing.T) {
	db := newQuestionsDB(t)
	tenantA, tenantB := uuid.New(), uuid.New()

	seedQuestions(t, db, tenantA, []models.Question{
		{Text: "QA1", Category: "sales", ExpectedDuration: 60},
		{Text: "QA2", Category: "product", ExpectedDuration: 90},
	})
	seedQuestions(t, db, tenantB, []models.Question{
		{Text: "QB1", Category: "sales", ExpectedDuration: 60},
	})

	r := routerWithQuestions(tenantA, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/questions", nil)
	r.ServeHTTP(w, req)

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["total"].(float64) != 2 {
		t.Errorf("tenant A should see 2 questions, got %v", resp["total"])
	}
}

func TestQuestionsList_Pagination(t *testing.T) {
	db := newQuestionsDB(t)
	tenantID := uuid.New()

	for i := 0; i < 7; i++ {
		db.Create(&models.Question{
			TenantID: tenantID, Text: "Q", Category: "sales", ExpectedDuration: 60,
		})
	}

	r := routerWithQuestions(tenantID, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/questions?page=2&limit=3", nil)
	r.ServeHTTP(w, req)

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if len(resp["data"].([]interface{})) != 3 {
		t.Errorf("expected 3 items on page 2, got %d", len(resp["data"].([]interface{})))
	}
	if resp["total"].(float64) != 7 {
		t.Errorf("expected total=7, got %v", resp["total"])
	}
	if resp["total_pages"].(float64) != 3 {
		t.Errorf("expected total_pages=3, got %v", resp["total_pages"])
	}
}

func TestQuestionsList_OrderedByCategoryThenCreatedAt(t *testing.T) {
	db := newQuestionsDB(t)
	tenantID := uuid.New()

	seedQuestions(t, db, tenantID, []models.Question{
		{Text: "Z product", Category: "product", ExpectedDuration: 60},
		{Text: "A sales", Category: "sales", ExpectedDuration: 60},
		{Text: "B product", Category: "product", ExpectedDuration: 60},
	})

	r := routerWithQuestions(tenantID, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/questions", nil)
	r.ServeHTTP(w, req)

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	data := resp["data"].([]interface{})
	first := data[0].(map[string]interface{})
	if first["category"] != "product" {
		t.Errorf("expected first category=product (alphabetical), got %v", first["category"])
	}
}
