package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func init() {
	gin.SetMode(gin.TestMode)
	os.Setenv("JWT_SECRET", "test-secret")
	os.Setenv("JWT_EXPIRY_MINUTES", "15")
	os.Setenv("JWT_REFRESH_EXPIRY_HOURS", "168")
}

// stubService permite testear los handlers sin DB.
type stubService struct {
	loginFn   func(email, password string) (*auth.TokenPair, error)
	refreshFn func(token string) (*auth.TokenPair, error)
}

func (s *stubService) Login(email, password string) (*auth.TokenPair, error) {
	return s.loginFn(email, password)
}

func (s *stubService) Refresh(token string) (*auth.TokenPair, error) {
	return s.refreshFn(token)
}

// authHandlerWithStub construye el handler con una interfaz en lugar de *auth.Service.
type authService interface {
	Login(email, password string) (*auth.TokenPair, error)
	Refresh(token string) (*auth.TokenPair, error)
}

type testAuthHandler struct {
	service authService
}

func (h *testAuthHandler) loginHandler(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	pair, err := h.service.Login(req.Email, req.Password)
	if err != nil {
		if err == auth.ErrInvalidCredentials {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, pair)
}

func (h *testAuthHandler) refreshHandler(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	pair, err := h.service.Refresh(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired refresh token"})
		return
	}
	c.JSON(http.StatusOK, pair)
}

func newTestRouter(svc authService) *gin.Engine {
	r := gin.New()
	h := &testAuthHandler{service: svc}
	r.POST("/auth/login", h.loginHandler)
	r.POST("/auth/refresh", h.refreshHandler)
	return r
}

// --- Login ---

func TestLogin_Success(t *testing.T) {
	pair := &auth.TokenPair{AccessToken: "acc", RefreshToken: "ref"}
	r := newTestRouter(&stubService{
		loginFn: func(_, _ string) (*auth.TokenPair, error) { return pair, nil },
	})

	body, _ := json.Marshal(map[string]string{"email": "user@test.com", "password": "secret123"})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp auth.TokenPair
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.AccessToken != "acc" {
		t.Errorf("expected access_token=acc, got %q", resp.AccessToken)
	}
}

func TestLogin_InvalidCredentials(t *testing.T) {
	r := newTestRouter(&stubService{
		loginFn: func(_, _ string) (*auth.TokenPair, error) { return nil, auth.ErrInvalidCredentials },
	})

	body, _ := json.Marshal(map[string]string{"email": "user@test.com", "password": "wrong123"})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestLogin_BadRequest(t *testing.T) {
	r := newTestRouter(&stubService{})

	body, _ := json.Marshal(map[string]string{"email": "not-an-email"})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

// --- Refresh ---

func TestRefresh_Success(t *testing.T) {
	userID := uuid.New()
	tenantID := uuid.New()
	validToken, _ := auth.GenerateRefreshToken(userID, tenantID, "admin")

	pair := &auth.TokenPair{AccessToken: "new-acc", RefreshToken: "new-ref"}
	r := newTestRouter(&stubService{
		refreshFn: func(_ string) (*auth.TokenPair, error) { return pair, nil },
	})

	body, _ := json.Marshal(map[string]string{"refresh_token": validToken})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/auth/refresh", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestRefresh_InvalidToken(t *testing.T) {
	r := newTestRouter(&stubService{
		refreshFn: func(_ string) (*auth.TokenPair, error) { return nil, auth.ErrUserNotFound },
	})

	body, _ := json.Marshal(map[string]string{"refresh_token": "bad-token"})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/auth/refresh", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

// --- Middleware ---

func TestAuthMiddleware_NoHeader(t *testing.T) {
	r := gin.New()
	r.GET("/protected", auth.Middleware(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/protected", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddleware_ValidToken(t *testing.T) {
	userID := uuid.New()
	tenantID := uuid.New()
	token, _ := auth.GenerateAccessToken(userID, tenantID, "admin")

	r := gin.New()
	r.GET("/protected", auth.Middleware(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestAuthMiddleware_RefreshTokenRejected(t *testing.T) {
	userID := uuid.New()
	tenantID := uuid.New()
	// refresh token no debe poder acceder a rutas protegidas
	token, _ := auth.GenerateRefreshToken(userID, tenantID, "admin")

	r := gin.New()
	r.GET("/protected", auth.Middleware(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for refresh token on protected route, got %d", w.Code)
	}
}
