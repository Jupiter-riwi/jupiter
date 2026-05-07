package rabbitmq

import (
	"context"
	"encoding/json"
	"testing"
	"time"
)

// --- JobMessage ---

func TestJobMessage_Serialization(t *testing.T) {
	msg := JobMessage{
		EvaluationID: "eval-123",
		TenantID:     "tenant-456",
		VideoKey:     "tenant/user/eval.mp4",
		JobType:      "pose",
		IssuedAt:     time.Now().UTC().Format(time.RFC3339),
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}

	var decoded JobMessage
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if decoded.EvaluationID != msg.EvaluationID {
		t.Errorf("evaluation_id: expected %s, got %s", msg.EvaluationID, decoded.EvaluationID)
	}
	if decoded.TenantID != msg.TenantID {
		t.Errorf("tenant_id: expected %s, got %s", msg.TenantID, decoded.TenantID)
	}
	if decoded.VideoKey != msg.VideoKey {
		t.Errorf("video_key: expected %s, got %s", msg.VideoKey, decoded.VideoKey)
	}
	if decoded.JobType != msg.JobType {
		t.Errorf("job_type: expected %s, got %s", msg.JobType, decoded.JobType)
	}
}

func TestQueueNames_AreStable(t *testing.T) {
	if QueuePose != "jupiter.pose" {
		t.Errorf("expected jupiter.pose, got %s", QueuePose)
	}
	if QueueWhisper != "jupiter.whisper" {
		t.Errorf("expected jupiter.whisper, got %s", QueueWhisper)
	}
	if QueueProsody != "jupiter.prosody" {
		t.Errorf("expected jupiter.prosody, got %s", QueueProsody)
	}
}

// --- Stub publisher for handler-level tests ---

type StubPublisher struct {
	Published []struct {
		Queue string
		Msg   JobMessage
	}
	Err error
}

func (s *StubPublisher) PublishJob(_ context.Context, queue string, msg JobMessage) error {
	if s.Err != nil {
		return s.Err
	}
	s.Published = append(s.Published, struct {
		Queue string
		Msg   JobMessage
	}{queue, msg})
	return nil
}

func TestStubPublisher_RecordsMessages(t *testing.T) {
	stub := &StubPublisher{}

	msg := JobMessage{EvaluationID: "e1", TenantID: "t1", VideoKey: "v.mp4", JobType: "pose"}
	_ = stub.PublishJob(context.Background(), QueuePose, msg)
	_ = stub.PublishJob(context.Background(), QueueWhisper, JobMessage{JobType: "whisper"})

	if len(stub.Published) != 2 {
		t.Errorf("expected 2 published messages, got %d", len(stub.Published))
	}
	if stub.Published[0].Queue != QueuePose {
		t.Errorf("expected queue %s, got %s", QueuePose, stub.Published[0].Queue)
	}
}

func TestJobMessage_AllThreeQueues(t *testing.T) {
	stub := &StubPublisher{}

	queues := []string{QueuePose, QueueWhisper, QueueProsody}
	types := []string{"pose", "whisper", "prosody"}

	for i, q := range queues {
		_ = stub.PublishJob(context.Background(), q, JobMessage{JobType: types[i]})
	}

	if len(stub.Published) != 3 {
		t.Fatalf("expected 3 jobs published, got %d", len(stub.Published))
	}

	for i, p := range stub.Published {
		if p.Msg.JobType != types[i] {
			t.Errorf("job %d: expected type %s, got %s", i, types[i], p.Msg.JobType)
		}
	}
}
