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

func newListDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db.AutoMigrate(&models.Tenant{}, &models.User{}, &models.Evaluation{})
	return db
}

func makeListHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := c.MustGet("claims").(*auth.Claims)
		query := db.Model(&models.Evaluation{}).
			Where("tenant_id = ? AND user_id = ?", claims.TenantID, claims.UserID)

		if status := c.Query("status"); status != "" {
			query = query.Where("status = ?", status)
		}

		page, limit := parsePagination(c)
		offset := (page - 1) * limit

		var total int64
		query.Count(&total)

		var evals []models.Evaluation
		query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&evals)

		items := make([]evaluationResponse, len(evals))
		for i, e := range evals {
			items[i] = buildEvaluationResponse(e)
		}

		totalPages := int(total) / limit
		if int(total)%limit != 0 {
			totalPages++
		}

		c.JSON(http.StatusOK, listResponse{
			Data: items, Total: total, Page: page, Limit: limit, TotalPages: totalPages,
		})
	}
}

func routerWithListHandler(tenantID, userID uuid.UUID, db *gorm.DB) *gin.Engine {
	r := gin.New()
	r.GET("/evaluations", func(c *gin.Context) {
		c.Set("claims", &auth.Claims{TenantID: tenantID, UserID: userID, Type: "access"})
		c.Next()
	}, makeListHandler(db))
	return r
}

func bulkSeedEvals(t *testing.T, db *gorm.DB, tenantID, userID uuid.UUID, count int, status models.EvaluationStatus) {
	t.Helper()
	for i := 0; i < count; i++ {
		db.Create(&models.Evaluation{
			TenantID: tenantID,
			UserID:   userID,
			Title:    "Eval",
			Status:   status,
			VideoKey: "key.mp4",
		})
	}
}

// --- Tests ---

func TestList_EmptyReturnsEmptyData(t *testing.T) {
	db := newListDB(t)
	tenantID, userID := uuid.New(), uuid.New()

	r := routerWithListHandler(tenantID, userID, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/evaluations", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp listResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.Total != 0 {
		t.Errorf("expected total=0, got %d", resp.Total)
	}
	if len(resp.Data) != 0 {
		t.Errorf("expected empty data, got %d items", len(resp.Data))
	}
}

func TestList_DefaultPagination(t *testing.T) {
	db := newListDB(t)
	tenantID, userID := uuid.New(), uuid.New()
	bulkSeedEvals(t, db, tenantID, userID, 5, models.StatusPending)

	r := routerWithListHandler(tenantID, userID, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/evaluations", nil)
	r.ServeHTTP(w, req)

	var resp listResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.Total != 5 {
		t.Errorf("expected total=5, got %d", resp.Total)
	}
	if resp.Page != 1 {
		t.Errorf("expected page=1, got %d", resp.Page)
	}
	if resp.Limit != 20 {
		t.Errorf("expected limit=20, got %d", resp.Limit)
	}
	if len(resp.Data) != 5 {
		t.Errorf("expected 5 items, got %d", len(resp.Data))
	}
}

func TestList_CustomPageAndLimit(t *testing.T) {
	db := newListDB(t)
	tenantID, userID := uuid.New(), uuid.New()
	bulkSeedEvals(t, db, tenantID, userID, 10, models.StatusPending)

	r := routerWithListHandler(tenantID, userID, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/evaluations?page=2&limit=3", nil)
	r.ServeHTTP(w, req)

	var resp listResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.Page != 2 {
		t.Errorf("expected page=2, got %d", resp.Page)
	}
	if resp.Limit != 3 {
		t.Errorf("expected limit=3, got %d", resp.Limit)
	}
	if len(resp.Data) != 3 {
		t.Errorf("expected 3 items on page 2, got %d", len(resp.Data))
	}
	if resp.Total != 10 {
		t.Errorf("expected total=10, got %d", resp.Total)
	}
}

func TestList_TotalPages(t *testing.T) {
	db := newListDB(t)
	tenantID, userID := uuid.New(), uuid.New()
	bulkSeedEvals(t, db, tenantID, userID, 7, models.StatusPending)

	r := routerWithListHandler(tenantID, userID, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/evaluations?limit=3", nil)
	r.ServeHTTP(w, req)

	var resp listResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	// 7 items / 3 per page = 3 pages (ceil)
	if resp.TotalPages != 3 {
		t.Errorf("expected total_pages=3, got %d", resp.TotalPages)
	}
}

func TestList_FilterByStatus(t *testing.T) {
	db := newListDB(t)
	tenantID, userID := uuid.New(), uuid.New()
	bulkSeedEvals(t, db, tenantID, userID, 4, models.StatusPending)
	bulkSeedEvals(t, db, tenantID, userID, 2, models.StatusCompleted)

	r := routerWithListHandler(tenantID, userID, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/evaluations?status=completed", nil)
	r.ServeHTTP(w, req)

	var resp listResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.Total != 2 {
		t.Errorf("expected total=2 for completed, got %d", resp.Total)
	}
	for _, item := range resp.Data {
		if item.Status != models.StatusCompleted {
			t.Errorf("expected all items to be completed, got %s", item.Status)
		}
	}
}

func TestList_TenantIsolation(t *testing.T) {
	db := newListDB(t)
	tenantA, tenantB := uuid.New(), uuid.New()
	userA := uuid.New()
	bulkSeedEvals(t, db, tenantA, userA, 3, models.StatusPending)
	bulkSeedEvals(t, db, tenantB, uuid.New(), 5, models.StatusPending)

	r := routerWithListHandler(tenantA, userA, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/evaluations", nil)
	r.ServeHTTP(w, req)

	var resp listResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.Total != 3 {
		t.Errorf("tenant A should see only 3 evals, got %d", resp.Total)
	}
}

func TestList_LimitCappedAt100(t *testing.T) {
	db := newListDB(t)
	tenantID, userID := uuid.New(), uuid.New()

	r := routerWithListHandler(tenantID, userID, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/evaluations?limit=999", nil)
	r.ServeHTTP(w, req)

	var resp listResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	// limit=999 should fall back to default 20 (out of range)
	if resp.Limit != 20 {
		t.Errorf("expected limit capped at 20 (default), got %d", resp.Limit)
	}
}

func TestList_InvalidPageFallsBackToDefault(t *testing.T) {
	db := newListDB(t)
	tenantID, userID := uuid.New(), uuid.New()

	r := routerWithListHandler(tenantID, userID, db)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/evaluations?page=-1", nil)
	r.ServeHTTP(w, req)

	var resp listResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.Page != 1 {
		t.Errorf("expected page=1 for invalid input, got %d", resp.Page)
	}
}

// --- parsePagination unit tests ---

func TestParsePagination_Defaults(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request, _ = http.NewRequest(http.MethodGet, "/", nil)

	page, limit := parsePagination(c)
	if page != 1 {
		t.Errorf("expected page=1, got %d", page)
	}
	if limit != 20 {
		t.Errorf("expected limit=20, got %d", limit)
	}
}

func TestParsePagination_ValidValues(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request, _ = http.NewRequest(http.MethodGet, "/?page=3&limit=10", nil)

	page, limit := parsePagination(c)
	if page != 3 {
		t.Errorf("expected page=3, got %d", page)
	}
	if limit != 10 {
		t.Errorf("expected limit=10, got %d", limit)
	}
}
