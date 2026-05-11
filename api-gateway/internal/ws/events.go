package ws

import (
	"encoding/json"
	"time"
)

type EventType string

const (
	EventConnected     EventType = "connected"
	EventStatusChanged EventType = "status_changed"
	EventJobCompleted  EventType = "job_completed"
	EventCompleted     EventType = "completed"
	EventError         EventType = "error"
)

// Event is the standardized WebSocket message envelope.
type Event struct {
	Event        EventType   `json:"event"`
	EvaluationID string      `json:"evaluation_id"`
	Status       string      `json:"status"`
	Payload      interface{} `json:"payload,omitempty"`
	Timestamp    string      `json:"timestamp"`
}

// CompletedPayload is sent when the evaluation finishes.
type CompletedPayload struct {
	Score    *float64    `json:"score"`
	Features interface{} `json:"features,omitempty"`
}

// ErrorPayload is sent when the evaluation fails.
type ErrorPayload struct {
	Message string `json:"message"`
}

func NewEvent(eventType EventType, evalID, status string, payload interface{}) Event {
	return Event{
		Event:        eventType,
		EvaluationID: evalID,
		Status:       status,
		Payload:      payload,
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
	}
}

func (e Event) Marshal() ([]byte, error) {
	return json.Marshal(e)
}
