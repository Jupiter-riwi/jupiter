package auth

import (
	"errors"
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID   uuid.UUID `json:"user_id"`
	TenantID uuid.UUID `json:"tenant_id"`
	Role     string    `json:"role"`
	Type     string    `json:"type"` // "access" or "refresh"
	jwt.RegisteredClaims
}

func jwtSecret() []byte {
	return []byte(os.Getenv("JWT_SECRET"))
}

func GenerateAccessToken(userID, tenantID uuid.UUID, role string) (string, error) {
	expiry := 15
	if v := os.Getenv("JWT_EXPIRY_MINUTES"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			expiry = n
		}
	}

	claims := Claims{
		UserID:   userID,
		TenantID: tenantID,
		Role:     role,
		Type:     "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expiry) * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(jwtSecret())
}

func GenerateRefreshToken(userID, tenantID uuid.UUID, role string) (string, error) {
	expiry := 168
	if v := os.Getenv("JWT_REFRESH_EXPIRY_HOURS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			expiry = n
		}
	}

	claims := Claims{
		UserID:   userID,
		TenantID: tenantID,
		Role:     role,
		Type:     "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expiry) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(jwtSecret())
}

func ValidateToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtSecret(), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}
