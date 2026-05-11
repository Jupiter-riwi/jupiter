package ws

import (
	"encoding/json"
	"testing"
	"time"
)

func TestNewEvent_FieldsPopulated(t *testing.T) {
	event := NewEvent(EventStatusChanged, "eval-1", "processing", nil)

	if event.Event != EventStatusChanged {
		t.Errorf("expected event=%s, got %s", EventStatusChanged, event.Event)
	}
	if event.EvaluationID != "eval-1" {
		t.Errorf("expected evaluation_id=eval-1, got %s", event.EvaluationID)
	}
	if event.Status != "processing" {
		t.Errorf("expected status=processing, got %s", event.Status)
	}
	if event.Timestamp == "" {
		t.Error("expected timestamp to be set")
	}

	// Timestamp must be valid RFC3339
	if _, err := time.Parse(time.RFC3339, event.Timestamp); err != nil {
		t.Errorf("timestamp is not RFC3339: %v", err)
	}
}

func TestEvent_Marshal_ValidJSON(t *testing.T) {
	event := NewEvent(EventCompleted, "eval-2", "completed", CompletedPayload{Score: floatPtr(92.5)})

	data, err := event.Marshal()
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}

	var decoded map[string]interface{}
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	if decoded["event"] != string(EventCompleted) {
		t.Errorf("expected event=completed, got %v", decoded["event"])
	}
	if decoded["evaluation_id"] != "eval-2" {
		t.Errorf("expected evaluation_id=eval-2, got %v", decoded["evaluation_id"])
	}
}

func TestEventType_Constants(t *testing.T) {
	cases := map[EventType]string{
		EventConnected:     "connected",
		EventStatusChanged: "status_changed",
		EventJobCompleted:  "job_completed",
		EventCompleted:     "completed",
		EventError:         "error",
	}
	for et, want := range cases {
		if string(et) != want {
			t.Errorf("expected %q, got %q", want, string(et))
		}
	}
}

func TestCompletedPayload_Serialization(t *testing.T) {
	score := 88.0
	payload := CompletedPayload{
		Score:    &score,
		Features: map[string]interface{}{"pose": 0.9, "fluency": 0.8},
	}

	event := NewEvent(EventCompleted, "e1", "completed", payload)
	data, _ := event.Marshal()

	var decoded map[string]interface{}
	json.Unmarshal(data, &decoded)

	rawPayload, ok := decoded["payload"].(map[string]interface{})
	if !ok {
		t.Fatal("payload should be a JSON object")
	}
	if rawPayload["score"] != 88.0 {
		t.Errorf("expected score=88.0, got %v", rawPayload["score"])
	}
}

func TestErrorPayload_Serialization(t *testing.T) {
	event := NewEvent(EventError, "e2", "failed", ErrorPayload{Message: "evaluation failed"})
	data, _ := event.Marshal()

	var decoded map[string]interface{}
	json.Unmarshal(data, &decoded)

	rawPayload, ok := decoded["payload"].(map[string]interface{})
	if !ok {
		t.Fatal("payload should be a JSON object")
	}
	if rawPayload["message"] != "evaluation failed" {
		t.Errorf("unexpected message: %v", rawPayload["message"])
	}
}

func TestEvent_NilPayload_OmittedFromJSON(t *testing.T) {
	event := NewEvent(EventConnected, "e3", "pending", nil)
	data, _ := event.Marshal()

	var decoded map[string]interface{}
	json.Unmarshal(data, &decoded)

	if _, exists := decoded["payload"]; exists {
		t.Error("payload should be omitted when nil")
	}
}

func TestNewEvent_TimestampIsRecent(t *testing.T) {
	before := time.Now().UTC().Add(-1 * time.Second)
	event := NewEvent(EventConnected, "e4", "pending", nil)
	after := time.Now().UTC().Add(1 * time.Second)

	ts, _ := time.Parse(time.RFC3339, event.Timestamp)
	if ts.Before(before) || ts.After(after) {
		t.Errorf("timestamp %v not within expected range [%v, %v]", ts, before, after)
	}
}

func floatPtr(f float64) *float64 { return &f }
