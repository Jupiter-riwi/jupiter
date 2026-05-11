package rabbitmq

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

const (
	QueuePose    = "pose.jobs"
	QueueWhisper = "whisper.jobs"
	QueueProsody = "prosody.jobs"
	QueueScoring = "scoring.jobs"
)

var AllQueues = []string{QueuePose, QueueWhisper, QueueProsody, QueueScoring, "scoring.jobs"}

type JobMessage struct {
	JobID        string `json:"job_id"`
	EvaluationID string `json:"evaluation_id"`
	TenantID     string `json:"tenant_id"`
	VideoKey     string `json:"video_key"`
	VideoURL     string `json:"video_url"`
	AudioURL     string `json:"audio_url"`
	JobType      string `json:"job_type"`
	IssuedAt     string `json:"issued_at"`
}

type Client struct {
	conn    *amqp.Connection
	channel *amqp.Channel
}

func NewClient() (*Client, error) {
	url := os.Getenv("RABBITMQ_URL")
	if url == "" {
		url = "amqp://guest:guest@localhost:5672/"
	}

	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("rabbitmq dial: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("rabbitmq channel: %w", err)
	}

	client := &Client{conn: conn, channel: ch}
	if err := client.declareQueues(); err != nil {
		client.Close()
		return nil, err
	}

	return client, nil
}

func (c *Client) declareQueues() error {
	for _, q := range AllQueues {
		_, err := c.channel.QueueDeclare(q, true, false, false, false, nil)
		if err != nil {
			return fmt.Errorf("declare queue %s: %w", q, err)
		}
	}
	return nil
}

// PublishJob sends a job message to the given queue.
func (c *Client) PublishJob(ctx context.Context, queue string, msg JobMessage) error {
	msg.IssuedAt = time.Now().UTC().Format(time.RFC3339)

	body, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	return c.channel.PublishWithContext(ctx, "", queue, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Body:         body,
	})
}

func (c *Client) Close() {
	if c.channel != nil {
		c.channel.Close()
	}
	if c.conn != nil {
		c.conn.Close()
	}
}
