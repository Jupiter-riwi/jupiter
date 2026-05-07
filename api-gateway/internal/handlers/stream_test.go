package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/auth"
	internalws "github.com/Jupiter-riwi/jupiter/api-gateway/internal/ws"
	"github.com/Jupiter-riwi/jupiter/api-gateway/pkg/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newStreamDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db.AutoMigrate(&models.Tenant{}, &models.User{}, &models.Evaluation{})
	return db
}

func makeStreamHandler(db *gorm.DB, tenantID, userID uuid.UUID) *gin.Engine {
	r := gin.New()
	r.GET("/evaluations/:id/stream", func(c *gin.Context) {
		c.Set("claims", &auth.Claims{TenantID: tenantID, UserID: userID, Type: "access"})
		c.Next()
	}, func(c *gin.Context) {
		evalID, ok := parseEvalID(c)
		if !ok {
			return
		}

		claims := c.MustGet("claims").(*auth.Claims)

		var eval models.Evaluation
		if err := db.Where("tenant_id = ?", claims.TenantID).
			First(&eval, "id = ? AND user_id = ?", evalID, claims.UserID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "evaluation not found"})
			return
		}

		conn, err := internalws.Upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		send := func(event internalws.Event) error {
			data, _ := event.Marshal()
			return conn.WriteMessage(websocket.TextMessage, data)
		}

		_ = send(internalws.NewEvent(internalws.EventConnected, eval.ID.String(), string(eval.Status), nil))

		ticker := time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()

		lastStatus := eval.Status

		for {
			select {
			case <-c.Request.Context().Done():
				return
			case <-ticker.C:
				var current models.Evaluation
				if err := db.First(&current, "id = ?", evalID).Error; err != nil {
					return
				}

				if current.Status != lastStatus {
					lastStatus = current.Status
					_ = send(internalws.NewEvent(internalws.EventStatusChanged, current.ID.String(), string(current.Status), nil))
				}

				if current.Status == models.StatusCompleted {
					_ = send(internalws.NewEvent(internalws.EventCompleted, current.ID.String(), string(current.Status), internalws.CompletedPayload{Score: current.Score}))
					return
				}

				if current.Status == models.StatusFailed {
					_ = send(internalws.NewEvent(internalws.EventError, current.ID.String(), string(current.Status), internalws.ErrorPayload{Message: "evaluation failed"}))
					return
				}
			}
		}
	})
	return r
}

func wsConnect(t *testing.T, server *httptest.Server, path string) *websocket.Conn {
	t.Helper()
	url := "ws" + strings.TrimPrefix(server.URL, "http") + path
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("ws dial: %v", err)
	}
	return conn
}

func readEvent(t *testing.T, conn *websocket.Conn) internalws.Event {
	t.Helper()
	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("ws read: %v", err)
	}
	var event internalws.Event
	if err := json.Unmarshal(data, &event); err != nil {
		t.Fatalf("unmarshal event: %v", err)
	}
	return event
}

// --- Tests ---

func TestStream_SendsConnectedEventOnConnect(t *testing.T) {
	db := newStreamDB(t)
	tenantID, userID := uuid.New(), uuid.New()
	db.Create(&models.Tenant{ID: tenantID, Name: "t", Domain: "t.co"})
	eval := seedEval(t, db, tenantID, userID, models.StatusProcessing, "key.mp4")

	r := makeStreamHandler(db, tenantID, userID)
	srv := httptest.NewServer(r)
	defer srv.Close()

	conn := wsConnect(t, srv, "/evaluations/"+eval.ID.String()+"/stream")
	defer conn.Close()

	event := readEvent(t, conn)
	if event.Event != internalws.EventConnected {
		t.Errorf("expected connected event, got %s", event.Event)
	}
	if event.EvaluationID != eval.ID.String() {
		t.Errorf("expected evaluation_id=%s, got %s", eval.ID, event.EvaluationID)
	}
	if event.Status != string(models.StatusProcessing) {
		t.Errorf("expected status=processing, got %s", event.Status)
	}
}

func TestStream_SendsCompletedEventWhenDone(t *testing.T) {
	db := newStreamDB(t)
	tenantID, userID := uuid.New(), uuid.New()
	db.Create(&models.Tenant{ID: tenantID, Name: "t2", Domain: "t2.co"})
	eval := seedEval(t, db, tenantID, userID, models.StatusProcessing, "key.mp4")

	r := makeStreamHandler(db, tenantID, userID)
	srv := httptest.NewServer(r)
	defer srv.Close()

	conn := wsConnect(t, srv, "/evaluations/"+eval.ID.String()+"/stream")
	defer conn.Close()

	// Consume connected event
	readEvent(t, conn)

	// Transition to completed
	score := 91.0
	db.Model(&eval).Updates(map[string]interface{}{"status": models.StatusCompleted, "score": score})

	// Wait for status_changed + completed events
	var events []internalws.Event
	for i := 0; i < 2; i++ {
		conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		ev := readEvent(t, conn)
		events = append(events, ev)
	}

	hasCompleted := false
	for _, ev := range events {
		if ev.Event == internalws.EventCompleted {
			hasCompleted = true
		}
	}
	if !hasCompleted {
		t.Error("expected completed event to be sent")
	}
}

func TestStream_SendsErrorEventOnFailure(t *testing.T) {
	db := newStreamDB(t)
	tenantID, userID := uuid.New(), uuid.New()
	db.Create(&models.Tenant{ID: tenantID, Name: "t3", Domain: "t3.co"})
	eval := seedEval(t, db, tenantID, userID, models.StatusProcessing, "key.mp4")

	r := makeStreamHandler(db, tenantID, userID)
	srv := httptest.NewServer(r)
	defer srv.Close()

	conn := wsConnect(t, srv, "/evaluations/"+eval.ID.String()+"/stream")
	defer conn.Close()

	readEvent(t, conn) // connected

	// Transition to failed
	db.Model(&eval).Update("status", models.StatusFailed)

	var events []internalws.Event
	for i := 0; i < 2; i++ {
		conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		ev, err := func() (internalws.Event, error) {
			_, data, err := conn.ReadMessage()
			if err != nil {
				return internalws.Event{}, err
			}
			var e internalws.Event
			return e, json.Unmarshal(data, &e)
		}()
		if err != nil {
			break
		}
		events = append(events, ev)
	}

	hasError := false
	for _, ev := range events {
		if ev.Event == internalws.EventError {
			hasError = true
		}
	}
	if !hasError {
		t.Error("expected error event to be sent on failure")
	}
}

func TestStream_EvalNotFound_Returns404(t *testing.T) {
	db := newStreamDB(t)
	tenantID, userID := uuid.New(), uuid.New()

	r := makeStreamHandler(db, tenantID, userID)
	srv := httptest.NewServer(r)
	defer srv.Close()

	// Non-WebSocket request should get 404
	resp, err := http.Get(srv.URL + "/evaluations/" + uuid.New().String() + "/stream")
	if err != nil {
		t.Fatalf("request error: %v", err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404, got %d", resp.StatusCode)
	}
}

func TestStream_InvalidUUID_Returns400(t *testing.T) {
	db := newStreamDB(t)
	tenantID, userID := uuid.New(), uuid.New()

	r := makeStreamHandler(db, tenantID, userID)
	srv := httptest.NewServer(r)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/evaluations/not-a-uuid/stream")
	if err != nil {
		t.Fatalf("request error: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestStream_StatusChangedEventHasCorrectFields(t *testing.T) {
	db := newStreamDB(t)
	tenantID, userID := uuid.New(), uuid.New()
	db.Create(&models.Tenant{ID: tenantID, Name: "t4", Domain: "t4.co"})
	eval := seedEval(t, db, tenantID, userID, models.StatusPending, "key.mp4")

	r := makeStreamHandler(db, tenantID, userID)
	srv := httptest.NewServer(r)
	defer srv.Close()

	conn := wsConnect(t, srv, "/evaluations/"+eval.ID.String()+"/stream")
	defer conn.Close()

	readEvent(t, conn) // connected

	// Change status
	db.Model(&eval).Update("status", models.StatusProcessing)

	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	event := readEvent(t, conn)

	if event.Event != internalws.EventStatusChanged {
		t.Errorf("expected status_changed, got %s", event.Event)
	}
	if event.Status != string(models.StatusProcessing) {
		t.Errorf("expected status=processing, got %s", event.Status)
	}
	if event.Timestamp == "" {
		t.Error("expected timestamp in event")
	}
}
