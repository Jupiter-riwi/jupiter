package handlers

import (
	"net/http"

	internaltenant "github.com/Jupiter-riwi/jupiter/api-gateway/internal/tenant"
	"github.com/Jupiter-riwi/jupiter/api-gateway/pkg/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type QuestionHandler struct {
	db *gorm.DB
}

func NewQuestionHandler(db *gorm.DB) *QuestionHandler {
	return &QuestionHandler{db: db}
}

func (h *QuestionHandler) List(c *gin.Context) {
	db := internaltenant.DBFromContext(c, h.db)

	query := db.Model(&models.Question{})

	if category := c.Query("category"); category != "" {
		query = query.Where("category = ?", category)
	}

	page, limit := parsePagination(c)
	offset := (page - 1) * limit

	var total int64
	query.Count(&total)

	var questions []models.Question
	if err := query.Order("category ASC, created_at ASC").Offset(offset).Limit(limit).Find(&questions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	totalPages := int(total) / limit
	if int(total)%limit != 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, gin.H{
		"data":        questions,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
	})
}
