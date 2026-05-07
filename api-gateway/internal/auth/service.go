package auth

import (
	"errors"

	"github.com/Jupiter-riwi/jupiter/api-gateway/pkg/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserNotFound       = errors.New("user not found")
	ErrEmailTaken         = errors.New("email already registered")
	ErrTenantNotFound     = errors.New("tenant not found")
)

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type RegisterInput struct {
	TenantID uuid.UUID
	Email    string
	Password string
	Role     models.Role
}

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

func (s *Service) Register(input RegisterInput) (*TokenPair, error) {
	var tenant models.Tenant
	if err := s.db.First(&tenant, "id = ?", input.TenantID).Error; err != nil {
		return nil, ErrTenantNotFound
	}

	var existing models.User
	if err := s.db.Where("email = ? AND tenant_id = ?", input.Email, input.TenantID).First(&existing).Error; err == nil {
		return nil, ErrEmailTaken
	}

	hash, err := HashPassword(input.Password)
	if err != nil {
		return nil, err
	}

	role := input.Role
	if role == "" {
		role = models.RoleMember
	}

	user := models.User{
		TenantID:     input.TenantID,
		Email:        input.Email,
		PasswordHash: hash,
		Role:         role,
	}

	if err := s.db.Create(&user).Error; err != nil {
		return nil, err
	}

	return s.generatePair(user.ID, user.TenantID, string(user.Role))
}

func (s *Service) Login(email, password string) (*TokenPair, error) {
	var user models.User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if !CheckPassword(user.PasswordHash, password) {
		return nil, ErrInvalidCredentials
	}

	return s.generatePair(user.ID, user.TenantID, string(user.Role))
}

func (s *Service) Refresh(refreshToken string) (*TokenPair, error) {
	claims, err := ValidateToken(refreshToken)
	if err != nil {
		return nil, err
	}

	if claims.Type != "refresh" {
		return nil, errors.New("invalid token type")
	}

	var user models.User
	if err := s.db.First(&user, "id = ?", claims.UserID).Error; err != nil {
		return nil, ErrUserNotFound
	}

	return s.generatePair(user.ID, user.TenantID, string(user.Role))
}

func (s *Service) generatePair(userID, tenantID uuid.UUID, role string) (*TokenPair, error) {
	accessToken, err := GenerateAccessToken(userID, tenantID, role)
	if err != nil {
		return nil, err
	}

	refreshToken, err := GenerateRefreshToken(userID, tenantID, role)
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}
