package models

import (
	"testing"

	"github.com/google/uuid"
)

func TestQuestion_BeforeCreate_AssignsUUID(t *testing.T) {
	q := &Question{}
	if err := q.BeforeCreate(nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if q.ID == uuid.Nil {
		t.Error("expected UUID to be assigned, got nil")
	}
}

func TestQuestion_BeforeCreate_PreservesExistingUUID(t *testing.T) {
	existing := uuid.New()
	q := &Question{ID: existing}
	_ = q.BeforeCreate(nil)
	if q.ID != existing {
		t.Errorf("expected ID to stay %s, got %s", existing, q.ID)
	}
}

func TestQuestion_RequiredFields(t *testing.T) {
	tenantID := uuid.New()
	q := Question{
		TenantID:         tenantID,
		Text:             "What is your value proposition?",
		Category:         "sales",
		ExpectedDuration: 120,
	}

	if q.TenantID != tenantID {
		t.Error("tenant_id not set correctly")
	}
	if q.Text == "" {
		t.Error("text should not be empty")
	}
	if q.Category == "" {
		t.Error("category should not be empty")
	}
	if q.ExpectedDuration <= 0 {
		t.Error("expected_duration_sec should be positive")
	}
}
