package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/auth"
	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/rabbitmq"
	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/storage"
	internaltenant "github.com/Jupiter-riwi/jupiter/api-gateway/internal/tenant"
	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/ws"
	"github.com/Jupiter-riwi/jupiter/api-gateway/pkg/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type EvaluationHandler struct {
	db    *gorm.DB
	minio *storage.MinioClient
	mq    *rabbitmq.Client
}

func NewEvaluationHandler(db *gorm.DB, minio *storage.MinioClient, mq *rabbitmq.Client) *EvaluationHandler {
	return &EvaluationHandler{db: db, minio: minio, mq: mq}
}

type createEvaluationRequest struct {
	Title string `json:"title" binding:"required,min=3,max=120"`
}

type createEvaluationResponse struct {
	Evaluation  models.Evaluation `json:"evaluation"`
	UploadURL   string            `json:"upload_url"`
	ExpiresInSec int              `json:"expires_in_sec"`
}

func (h *EvaluationHandler) Create(c *gin.Context) {
	var req createEvaluationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	claims := c.MustGet("claims").(*auth.Claims)
	db := internaltenant.DBFromContext(c, h.db)

	eval := models.Evaluation{
		TenantID: claims.TenantID,
		UserID:   claims.UserID,
		Title:    req.Title,
		Status:   models.StatusPending,
	}

	if err := db.Create(&eval).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create evaluation"})
		return
	}

	// Object key: tenant/user/evaluation-id.mp4
	videoKey := fmt.Sprintf("%s/%s/%s.mp4", claims.TenantID, claims.UserID, eval.ID)

	const presignExpiry = 15 * time.Minute
	uploadURL, err := h.minio.PresignedPutURL(context.Background(), videoKey, presignExpiry)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate upload URL"})
		return
	}

	// Persist the video key so we can reference it later
	db.Model(&eval).Update("video_key", videoKey)
	eval.VideoKey = videoKey

	c.JSON(http.StatusCreated, createEvaluationResponse{
		Evaluation:   eval,
		UploadURL:    uploadURL,
		ExpiresInSec: int(presignExpiry.Seconds()),
	})
}

func (h *EvaluationHandler) Complete(c *gin.Context) {
	evalID, ok := parseEvalID(c)
	if !ok {
		return
	}

	claims := c.MustGet("claims").(*auth.Claims)
	db := internaltenant.DBFromContext(c, h.db)

	var eval models.Evaluation
	if err := db.First(&eval, "id = ? AND user_id = ?", evalID, claims.UserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "evaluation not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if eval.Status == models.StatusProcessing || eval.Status == models.StatusCompleted {
		c.JSON(http.StatusConflict, gin.H{"error": "evaluation already processing or completed"})
		return
	}

	if eval.VideoKey == "" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "video not uploaded yet"})
		return
	}

	jobs := []struct {
		queue   string
		jobType string
	}{
		{rabbitmq.QueuePose, "pose"},
		{rabbitmq.QueueWhisper, "whisper"},
		{rabbitmq.QueueProsody, "prosody"},
	}

	msg := rabbitmq.JobMessage{
		EvaluationID: eval.ID.String(),
		TenantID:     eval.TenantID.String(),
		VideoKey:     eval.VideoKey,
	}

	for _, j := range jobs {
		msg.JobType = j.jobType
		if err := h.mq.PublishJob(c.Request.Context(), j.queue, msg); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to publish jobs"})
			return
		}
	}

	db.Model(&eval).Update("status", models.StatusProcessing)
	eval.Status = models.StatusProcessing

	c.JSON(http.StatusAccepted, eval)
}

type evaluationResponse struct {
	models.Evaluation
	Features interface{} `json:"features"`
}

func (h *EvaluationHandler) GetByID(c *gin.Context) {
	evalID, ok := parseEvalID(c)
	if !ok {
		return
	}

	db := internaltenant.DBFromContext(c, h.db)

	var eval models.Evaluation
	if err := db.First(&eval, "id = ?", evalID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "evaluation not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	resp := buildEvaluationResponse(eval)
	c.JSON(http.StatusOK, resp)
}

// buildEvaluationResponse parses features JSON when the evaluation is completed.
func buildEvaluationResponse(eval models.Evaluation) evaluationResponse {
	resp := evaluationResponse{Evaluation: eval}

	if eval.Status == models.StatusCompleted && len(eval.Features) > 0 {
		var features interface{}
		if err := json.Unmarshal(eval.Features, &features); err == nil {
			resp.Features = features
		}
	}

	return resp
}

type listResponse struct {
	Data       []evaluationResponse `json:"data"`
	Total      int64                `json:"total"`
	Page       int                  `json:"page"`
	Limit      int                  `json:"limit"`
	TotalPages int                  `json:"total_pages"`
}

func (h *EvaluationHandler) List(c *gin.Context) {
	claims := c.MustGet("claims").(*auth.Claims)
	db := internaltenant.DBFromContext(c, h.db)

	page, limit := parsePagination(c)
	offset := (page - 1) * limit

	query := db.Model(&models.Evaluation{}).Where("user_id = ?", claims.UserID)

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var evals []models.Evaluation
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&evals).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	items := make([]evaluationResponse, len(evals))
	for i, e := range evals {
		items[i] = buildEvaluationResponse(e)
	}

	totalPages := int(total) / limit
	if int(total)%limit != 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, listResponse{
		Data:       items,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	})
}

// parsePagination extracts and clamps page/limit query params.
func parsePagination(c *gin.Context) (page, limit int) {
	page = 1
	limit = 20

	if p := c.Query("page"); p != "" {
		if v, err := parseInt(p); err == nil && v > 0 {
			page = v
		}
	}
	if l := c.Query("limit"); l != "" {
		if v, err := parseInt(l); err == nil && v > 0 && v <= 100 {
			limit = v
		}
	}
	return
}

func parseInt(s string) (int, error) {
	var v int
	_, err := fmt.Sscanf(s, "%d", &v)
	return v, err
}

func (h *EvaluationHandler) Stream(c *gin.Context) {
	evalID, ok := parseEvalID(c)
	if !ok {
		return
	}

	claims := c.MustGet("claims").(*auth.Claims)
	db := internaltenant.DBFromContext(c, h.db)

	var eval models.Evaluation
	if err := db.First(&eval, "id = ? AND user_id = ?", evalID, claims.UserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "evaluation not found"})
		return
	}

	conn, err := ws.Upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	send := func(event ws.Event) error {
		data, err := event.Marshal()
		if err != nil {
			return err
		}
		return conn.WriteMessage(1, data) // 1 = TextMessage
	}

	_ = send(ws.NewEvent(ws.EventConnected, eval.ID.String(), string(eval.Status), nil))

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	lastStatus := eval.Status

	for {
		select {
		case <-c.Request.Context().Done():
			return
		case <-ticker.C:
			var current models.Evaluation
			if err := db.First(&current, "id = ?", evalID).Error; err != nil {
				_ = send(ws.NewEvent(ws.EventError, evalID.String(), "", ws.ErrorPayload{Message: "evaluation not found"}))
				return
			}

			if current.Status != lastStatus {
				lastStatus = current.Status
				_ = send(ws.NewEvent(ws.EventStatusChanged, current.ID.String(), string(current.Status), nil))
			}

			if current.Status == models.StatusCompleted {
				var features interface{}
				if len(current.Features) > 0 {
					_ = json.Unmarshal(current.Features, &features)
				}
				_ = send(ws.NewEvent(ws.EventCompleted, current.ID.String(), string(current.Status), ws.CompletedPayload{
					Score:    current.Score,
					Features: features,
				}))
				return
			}

			if current.Status == models.StatusFailed {
				_ = send(ws.NewEvent(ws.EventError, current.ID.String(), string(current.Status), ws.ErrorPayload{Message: "evaluation failed"}))
				return
			}
		}
	}
}

// parseEvalID is a shared helper to extract and validate the {id} path param.
func parseEvalID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid evaluation id"})
		return uuid.Nil, false
	}
	return id, true
}
