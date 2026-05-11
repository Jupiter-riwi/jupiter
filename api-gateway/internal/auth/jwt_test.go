package auth

import (
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
)

func setup() {
	os.Setenv("JWT_SECRET", "test-secret")
	os.Setenv("JWT_EXPIRY_MINUTES", "15")
	os.Setenv("JWT_REFRESH_EXPIRY_HOURS", "168")
}

func TestGenerateAccessToken_ValidClaims(t *testing.T) {
	setup()
	userID := uuid.New()
	tenantID := uuid.New()

	token, err := GenerateAccessToken(userID, tenantID, "admin")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	claims, err := ValidateToken(token)
	if err != nil {
		t.Fatalf("failed to validate token: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("expected userID %s, got %s", userID, claims.UserID)
	}
	if claims.TenantID != tenantID {
		t.Errorf("expected tenantID %s, got %s", tenantID, claims.TenantID)
	}
	if claims.Role != "admin" {
		t.Errorf("expected role admin, got %s", claims.Role)
	}
	if claims.Type != "access" {
		t.Errorf("expected type access, got %s", claims.Type)
	}
}

func TestGenerateRefreshToken_ValidClaims(t *testing.T) {
	setup()
	userID := uuid.New()
	tenantID := uuid.New()

	token, err := GenerateRefreshToken(userID, tenantID, "member")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	claims, err := ValidateToken(token)
	if err != nil {
		t.Fatalf("failed to validate token: %v", err)
	}

	if claims.Type != "refresh" {
		t.Errorf("expected type refresh, got %s", claims.Type)
	}
}

func TestValidateToken_InvalidSignature(t *testing.T) {
	setup()
	_, err := ValidateToken("invalid.token.string")
	if err == nil {
		t.Error("expected error for invalid token, got nil")
	}
}

func TestValidateToken_WrongSecret(t *testing.T) {
	setup()
	userID := uuid.New()
	tenantID := uuid.New()

	token, _ := GenerateAccessToken(userID, tenantID, "admin")

	os.Setenv("JWT_SECRET", "different-secret")
	_, err := ValidateToken(token)
	if err == nil {
		t.Error("expected error with wrong secret, got nil")
	}
}

func TestAccessToken_Expiry(t *testing.T) {
	setup()
	userID := uuid.New()
	tenantID := uuid.New()

	token, _ := GenerateAccessToken(userID, tenantID, "admin")
	claims, err := ValidateToken(token)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := time.Now().Add(15 * time.Minute)
	diff := claims.ExpiresAt.Time.Sub(expected)
	if diff < -5*time.Second || diff > 5*time.Second {
		t.Errorf("expiry not within expected range, got %v", claims.ExpiresAt.Time)
	}
}

func TestRefreshToken_CannotBeUsedAsAccess(t *testing.T) {
	setup()
	userID := uuid.New()
	tenantID := uuid.New()

	token, _ := GenerateRefreshToken(userID, tenantID, "admin")
	claims, err := ValidateToken(token)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if claims.Type == "access" {
		t.Error("refresh token should not have type=access")
	}
}
