package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// testRouter returns a router with nil handlers — safe for testing routes
// that do not invoke any handler methods (/health, /docs, 404, 405).
func testRouter() *gin.Engine {
	return setupRouter(nil, nil, nil, nil)
}

func TestHealthEndpoint(t *testing.T) {
	r := testRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/health", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("response is not valid JSON: %v", err)
	}

	if body["status"] != "ok" {
		t.Errorf("expected status=ok, got %q", body["status"])
	}
}

func TestHealthEndpoint_MethodNotAllowed(t *testing.T) {
	r := testRouter()

	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodDelete} {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(method, "/health", nil)
		r.ServeHTTP(w, req)

		if w.Code != http.StatusMethodNotAllowed {
			t.Errorf("method %s: expected 405, got %d", method, w.Code)
		}
	}
}

func TestUnknownRoute(t *testing.T) {
	r := testRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/nonexistent", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status 404, got %d", w.Code)
	}
}

func TestDocsEndpoint_ReturnsOpenAPISpec(t *testing.T) {
	r := testRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/docs", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var spec map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &spec); err != nil {
		t.Fatalf("/docs response is not valid JSON: %v", err)
	}

	if spec["openapi"] != "3.0.3" {
		t.Errorf("expected openapi=3.0.3, got %v", spec["openapi"])
	}

	info, ok := spec["info"].(map[string]any)
	if !ok {
		t.Fatal("missing 'info' object in OpenAPI spec")
	}
	if info["title"] != "Jupiter API" {
		t.Errorf("expected title='Jupiter API', got %v", info["title"])
	}

	paths, ok := spec["paths"].(map[string]any)
	if !ok {
		t.Fatal("missing 'paths' object in OpenAPI spec")
	}

	required := []string{"/health", "/auth/login", "/auth/register", "/auth/refresh", "/me", "/questions", "/evaluations", "/evaluations/{id}", "/evaluations/{id}/complete", "/evaluations/{id}/stream"}
	for _, p := range required {
		if _, exists := paths[p]; !exists {
			t.Errorf("OpenAPI spec missing path: %s", p)
		}
	}
}

func TestDocsEndpoint_MethodNotAllowed(t *testing.T) {
	r := testRouter()

	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodDelete} {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(method, "/docs", nil)
		r.ServeHTTP(w, req)

		if w.Code != http.StatusMethodNotAllowed {
			t.Errorf("method %s: expected 405, got %d", method, w.Code)
		}
	}
}
