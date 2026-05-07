package tenant

import (
	"net/http"

	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/auth"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const dbKey = "tenant_db"

// Middleware scopes every DB query to the authenticated tenant.
// Must run after auth.Middleware() so claims are already set.
func Middleware(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, exists := c.Get("claims")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		authClaims := claims.(*auth.Claims)
		scopedDB := db.Where("tenant_id = ?", authClaims.TenantID)
		c.Set(dbKey, scopedDB)
		c.Next()
	}
}

// DBFromContext retrieves the tenant-scoped DB from the gin context.
// Falls back to the global db if the scoped one is not set.
func DBFromContext(c *gin.Context, fallback *gorm.DB) *gorm.DB {
	if val, exists := c.Get(dbKey); exists {
		if db, ok := val.(*gorm.DB); ok {
			return db
		}
	}
	return fallback
}
