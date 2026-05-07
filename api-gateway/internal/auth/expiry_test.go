package auth

import (
	"os"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func TestExpiredAccessToken_IsRejected(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret")

	// Construye manualmente un token ya expirado
	claims := Claims{
		UserID:   uuid.New(),
		TenantID: uuid.New(),
		Role:     "admin",
		Type:     "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Minute)),
		},
	}

	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(jwtSecret())
	if err != nil {
		t.Fatalf("failed to create token: %v", err)
	}

	_, err = ValidateToken(token)
	if err == nil {
		t.Error("expected error for expired token, got nil")
	}
}

func TestExpiredRefreshToken_IsRejected(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret")

	claims := Claims{
		UserID:   uuid.New(),
		TenantID: uuid.New(),
		Role:     "member",
		Type:     "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
		},
	}

	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(jwtSecret())
	if err != nil {
		t.Fatalf("failed to create token: %v", err)
	}

	_, err = ValidateToken(token)
	if err == nil {
		t.Error("expected error for expired refresh token, got nil")
	}
}

func TestRefreshCycle_NewPairHasFreshExpiry(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret")
	os.Setenv("JWT_EXPIRY_MINUTES", "15")
	os.Setenv("JWT_REFRESH_EXPIRY_HOURS", "168")

	userID := uuid.New()
	tenantID := uuid.New()

	refreshToken, err := GenerateRefreshToken(userID, tenantID, "admin")
	if err != nil {
		t.Fatalf("failed to generate refresh token: %v", err)
	}

	// Simula un pequeño delay y genera nuevo par
	time.Sleep(10 * time.Millisecond)

	newAccess, err := GenerateAccessToken(userID, tenantID, "admin")
	if err != nil {
		t.Fatalf("failed to generate new access token: %v", err)
	}

	newClaims, err := ValidateToken(newAccess)
	if err != nil {
		t.Fatalf("new access token invalid: %v", err)
	}

	oldClaims, _ := ValidateToken(refreshToken)

	// El nuevo access token debe expirar después de la emisión del refresh
	if !newClaims.ExpiresAt.After(oldClaims.IssuedAt.Time) {
		t.Error("new access token should expire after the refresh token was issued")
	}
}

func TestPassword_HashAndCheck(t *testing.T) {
	plain := "my-secure-password"
	hash, err := HashPassword(plain)
	if err != nil {
		t.Fatalf("unexpected error hashing: %v", err)
	}

	if hash == plain {
		t.Error("hash should not equal plain text")
	}

	if !CheckPassword(hash, plain) {
		t.Error("CheckPassword should return true for correct password")
	}

	if CheckPassword(hash, "wrong-password") {
		t.Error("CheckPassword should return false for wrong password")
	}
}

func TestPassword_DifferentHashesForSameInput(t *testing.T) {
	plain := "same-password"
	hash1, _ := HashPassword(plain)
	hash2, _ := HashPassword(plain)

	// bcrypt genera salt distinto cada vez
	if hash1 == hash2 {
		t.Error("two hashes of the same password should differ due to salt")
	}

	if !CheckPassword(hash1, plain) || !CheckPassword(hash2, plain) {
		t.Error("both hashes should validate correctly")
	}
}
