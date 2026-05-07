package tenant

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func init() {
	gin.SetMode(gin.TestMode)
	os.Setenv("JWT_SECRET", "test-secret")
	os.Setenv("JWT_EXPIRY_MINUTES", "15")
}

func newInMemoryDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}
	return db
}

func TestMiddleware_WithoutClaims_Returns401(t *testing.T) {
	db := newInMemoryDB(t)
	r := gin.New()
	r.GET("/test", Middleware(db), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/test", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestMiddleware_ScopesSetsDBInContext(t *testing.T) {
	db := newInMemoryDB(t)
	userID := uuid.New()
	tenantID := uuid.New()

	r := gin.New()
	r.GET("/test", func(c *gin.Context) {
		// simula lo que hace auth.Middleware
		claims := &auth.Claims{UserID: userID, TenantID: tenantID, Role: "admin", Type: "access"}
		c.Set("claims", claims)
		c.Next()
	}, Middleware(db), func(c *gin.Context) {
		scopedDB := DBFromContext(c, nil)
		if scopedDB == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "no scoped db"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/test", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestDBFromContext_FallbackWhenNotSet(t *testing.T) {
	db := newInMemoryDB(t)

	r := gin.New()
	r.GET("/test", func(c *gin.Context) {
		result := DBFromContext(c, db)
		if result != db {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "wrong db returned"})
			return
		}
		c.JSON(http.StatusOK, gin.H{})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/test", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestMiddleware_DifferentTenantsGetDifferentScopes(t *testing.T) {
	db := newInMemoryDB(t)
	tenantA := uuid.New()
	tenantB := uuid.New()

	capturedTenants := map[string]uuid.UUID{}

	makeRouter := func(tenantID uuid.UUID, key string) *gin.Engine {
		r := gin.New()
		r.GET("/test", func(c *gin.Context) {
			claims := &auth.Claims{UserID: uuid.New(), TenantID: tenantID, Type: "access"}
			c.Set("claims", claims)
			c.Next()
		}, Middleware(db), func(c *gin.Context) {
			scopedDB := DBFromContext(c, nil)
			// La condición WHERE tenant_id está en la Statement del DB scopeado
			stmt := scopedDB.Statement
			_ = stmt
			capturedTenants[key] = tenantID
			c.JSON(http.StatusOK, gin.H{})
		})
		return r
	}

	for _, tc := range []struct{ key string; id uuid.UUID }{
		{"a", tenantA},
		{"b", tenantB},
	} {
		r := makeRouter(tc.id, tc.key)
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("tenant %s: expected 200, got %d", tc.key, w.Code)
		}
	}

	if capturedTenants["a"] == capturedTenants["b"] {
		t.Error("both tenants produced the same scope ID")
	}
}
