package e2e

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/auth"
	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/handlers"
	internaltenant "github.com/Jupiter-riwi/jupiter/api-gateway/internal/tenant"
	"github.com/Jupiter-riwi/jupiter/api-gateway/pkg/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func init() {
	gin.SetMode(gin.TestMode)
	os.Setenv("JWT_SECRET", "e2e-test-secret")
	os.Setenv("JWT_EXPIRY_MINUTES", "15")
	os.Setenv("JWT_REFRESH_EXPIRY_HOURS", "168")
}

// --- helpers ---

func setupApp(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open db: %v", err)
	}
	if err := db.AutoMigrate(&models.Tenant{}, &models.User{}); err != nil {
		t.Fatalf("migration failed: %v", err)
	}

	svc := auth.NewService(db)
	h := handlers.NewAuthHandler(svc, db)

	r := gin.New()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	authGroup := r.Group("/auth")
	authGroup.POST("/register", h.Register)
	authGroup.POST("/login", h.Login)
	authGroup.POST("/refresh", h.Refresh)

	protected := r.Group("/")
	protected.Use(auth.Middleware(), internaltenant.Middleware(db))
	protected.GET("/me", h.Me)

	return r, db
}

func seedTenant(t *testing.T, db *gorm.DB, name, domain string) models.Tenant {
	t.Helper()
	tenant := models.Tenant{Name: name, Domain: domain}
	if err := db.Create(&tenant).Error; err != nil {
		t.Fatalf("seed tenant %q: %v", name, err)
	}
	return tenant
}

func doPost(r *gin.Engine, path string, body any, token string) *httptest.ResponseRecorder {
	data, _ := json.Marshal(body)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, path, bytes.NewBuffer(data))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	r.ServeHTTP(w, req)
	return w
}

func doGet(r *gin.Engine, path, token string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, path, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	r.ServeHTTP(w, req)
	return w
}

func mustRegister(t *testing.T, r *gin.Engine, tenantID uuid.UUID, email, password string) auth.TokenPair {
	t.Helper()
	w := doPost(r, "/auth/register", map[string]string{
		"tenant_id": tenantID.String(),
		"email":     email,
		"password":  password,
	}, "")
	if w.Code != http.StatusCreated {
		t.Fatalf("register %q: expected 201, got %d — %s", email, w.Code, w.Body.String())
	}
	var pair auth.TokenPair
	json.Unmarshal(w.Body.Bytes(), &pair)
	return pair
}

// --- E2E tests ---

// Flujo completo: registro → login → /me
func TestE2E_RegisterLoginMe(t *testing.T) {
	r, db := setupApp(t)
	tenant := seedTenant(t, db, "acme", "acme.test")

	pair := mustRegister(t, r, tenant.ID, "alice@acme.test", "secret123")
	if pair.AccessToken == "" || pair.RefreshToken == "" {
		t.Fatal("register: missing tokens")
	}

	// Login independiente confirma credenciales
	w := doPost(r, "/auth/login", map[string]string{
		"email": "alice@acme.test", "password": "secret123",
	}, "")
	if w.Code != http.StatusOK {
		t.Fatalf("login: expected 200, got %d — %s", w.Code, w.Body.String())
	}
	var loginPair auth.TokenPair
	json.Unmarshal(w.Body.Bytes(), &loginPair)

	// GET /me con token de login
	w = doGet(r, "/me", loginPair.AccessToken)
	if w.Code != http.StatusOK {
		t.Fatalf("/me: expected 200, got %d — %s", w.Code, w.Body.String())
	}
	var me map[string]any
	json.Unmarshal(w.Body.Bytes(), &me)
	if me["email"] != "alice@acme.test" {
		t.Errorf("/me: expected email alice@acme.test, got %v", me["email"])
	}
}

// Refresco: refresh_token genera un nuevo access_token funcional
func TestE2E_RefreshFlow(t *testing.T) {
	r, db := setupApp(t)
	tenant := seedTenant(t, db, "beta-corp", "beta.test")

	pair := mustRegister(t, r, tenant.ID, "bob@beta.test", "secure456")

	w := doPost(r, "/auth/refresh", map[string]string{
		"refresh_token": pair.RefreshToken,
	}, "")
	if w.Code != http.StatusOK {
		t.Fatalf("refresh: expected 200, got %d — %s", w.Code, w.Body.String())
	}

	var newPair auth.TokenPair
	json.Unmarshal(w.Body.Bytes(), &newPair)

	if newPair.AccessToken == "" {
		t.Fatal("refresh: missing new access_token")
	}
	if newPair.AccessToken == pair.AccessToken {
		t.Error("refresh: new access_token should differ from the original")
	}

	// Nuevo token funciona en /me
	w = doGet(r, "/me", newPair.AccessToken)
	if w.Code != http.StatusOK {
		t.Fatalf("/me with refreshed token: expected 200, got %d", w.Code)
	}
}

// Aislamiento multi-tenant: cada tenant solo ve sus propios datos
func TestE2E_TenantIsolation(t *testing.T) {
	r, db := setupApp(t)
	tenantA := seedTenant(t, db, "company-a", "a.example")
	tenantB := seedTenant(t, db, "company-b", "b.example")

	pairA := mustRegister(t, r, tenantA.ID, "user@a.example", "passA123")
	pairB := mustRegister(t, r, tenantB.ID, "user@b.example", "passB123")

	// Tenant A ve sus datos
	w := doGet(r, "/me", pairA.AccessToken)
	if w.Code != http.StatusOK {
		t.Fatalf("tenant A /me: expected 200, got %d", w.Code)
	}
	var meA map[string]any
	json.Unmarshal(w.Body.Bytes(), &meA)
	if meA["email"] != "user@a.example" {
		t.Errorf("tenant A: expected user@a.example, got %v", meA["email"])
	}

	// Tenant B ve sus datos, no los de A
	w = doGet(r, "/me", pairB.AccessToken)
	if w.Code != http.StatusOK {
		t.Fatalf("tenant B /me: expected 200, got %d", w.Code)
	}
	var meB map[string]any
	json.Unmarshal(w.Body.Bytes(), &meB)
	if meB["email"] != "user@b.example" {
		t.Errorf("tenant B: expected user@b.example, got %v", meB["email"])
	}

	// IDs de usuario son distintos
	if meA["id"] == meB["id"] {
		t.Error("tenants A and B should not share user IDs")
	}
}

// Rechazo de recurso ajeno: sin token o token inválido → 401
func TestE2E_UnauthorizedRejection(t *testing.T) {
	r, _ := setupApp(t)

	// Sin token
	w := doGet(r, "/me", "")
	if w.Code != http.StatusUnauthorized {
		t.Errorf("no token: expected 401, got %d", w.Code)
	}

	// Token malformado
	w = doGet(r, "/me", "not.a.valid.token")
	if w.Code != http.StatusUnauthorized {
		t.Errorf("invalid token: expected 401, got %d", w.Code)
	}

	// Refresh token usado en ruta protegida (solo access tokens son válidos)
	db_tmp, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db_tmp.AutoMigrate(&models.Tenant{}, &models.User{})
	t2 := seedTenant(t, db_tmp, "tmp", "tmp.test")
	r2, _ := setupApp(t)
	_ = t2
	pair := mustRegister(t, r2, seedTenant(t, db_tmp, "x", "x.test").ID, "x@x.test", "pass1234")
	// reusar r con el refresh token
	w = doGet(r, "/me", pair.RefreshToken)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("refresh token on protected route: expected 401, got %d", w.Code)
	}
}

// Email duplicado en el mismo tenant → 409
func TestE2E_DuplicateEmailSameTenant(t *testing.T) {
	r, db := setupApp(t)
	tenant := seedTenant(t, db, "delta-inc", "delta.test")

	mustRegister(t, r, tenant.ID, "dup@delta.test", "pass1234")

	w := doPost(r, "/auth/register", map[string]string{
		"tenant_id": tenant.ID.String(),
		"email":     "dup@delta.test",
		"password":  "pass1234",
	}, "")
	if w.Code != http.StatusConflict {
		t.Errorf("duplicate email: expected 409, got %d", w.Code)
	}
}

// Mismo email en distintos tenants → permitido
func TestE2E_SameEmailDifferentTenants(t *testing.T) {
	r, db := setupApp(t)
	tenantA := seedTenant(t, db, "alpha-llc", "alpha.test")
	tenantB := seedTenant(t, db, "bravo-llc", "bravo.test")

	email := "shared@example.com"

	wA := doPost(r, "/auth/register", map[string]string{
		"tenant_id": tenantA.ID.String(), "email": email, "password": "passA123",
	}, "")
	wB := doPost(r, "/auth/register", map[string]string{
		"tenant_id": tenantB.ID.String(), "email": email, "password": "passB123",
	}, "")

	if wA.Code != http.StatusCreated {
		t.Errorf("tenant A: expected 201, got %d", wA.Code)
	}
	if wB.Code != http.StatusCreated {
		t.Errorf("tenant B: expected 201, got %d — same email must be allowed across tenants", wB.Code)
	}
}

// Login con contraseña incorrecta → 401
func TestE2E_WrongPassword(t *testing.T) {
	r, db := setupApp(t)
	tenant := seedTenant(t, db, "gamma-co", "gamma.test")
	mustRegister(t, r, tenant.ID, "carol@gamma.test", "correct-pass")

	w := doPost(r, "/auth/login", map[string]string{
		"email": "carol@gamma.test", "password": "wrong-pass",
	}, "")
	if w.Code != http.StatusUnauthorized {
		t.Errorf("wrong password: expected 401, got %d", w.Code)
	}
}
