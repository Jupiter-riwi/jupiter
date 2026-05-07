package main

import (
	"testing"

	"github.com/Jupiter-riwi/jupiter/api-gateway/pkg/models"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newSeedDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("db open: %v", err)
	}
	db.AutoMigrate(&models.Tenant{}, &models.Question{})
	return db
}

func TestSeedQuestions_InsertsAllQuestions(t *testing.T) {
	db := newSeedDB(t)
	tenantID := uuid.New()
	db.Create(&models.Tenant{ID: tenantID, Name: "Test Co", Domain: "test.co"})

	count := seedQuestions(db, tenantID)

	if count != len(demoQuestions) {
		t.Errorf("expected %d questions seeded, got %d", len(demoQuestions), count)
	}

	var total int64
	db.Model(&models.Question{}).Where("tenant_id = ?", tenantID).Count(&total)
	if int(total) != len(demoQuestions) {
		t.Errorf("expected %d questions in DB, got %d", len(demoQuestions), total)
	}
}

func TestSeedQuestions_Idempotent(t *testing.T) {
	db := newSeedDB(t)
	tenantID := uuid.New()
	db.Create(&models.Tenant{ID: tenantID, Name: "Test Co", Domain: "test.co"})

	seedQuestions(db, tenantID)
	seedQuestions(db, tenantID) // second run should not duplicate

	var total int64
	db.Model(&models.Question{}).Where("tenant_id = ?", tenantID).Count(&total)
	if int(total) != len(demoQuestions) {
		t.Errorf("seed is not idempotent: expected %d questions, got %d", len(demoQuestions), total)
	}
}

func TestSeedQuestions_AllFieldsPresent(t *testing.T) {
	db := newSeedDB(t)
	tenantID := uuid.New()
	db.Create(&models.Tenant{ID: tenantID, Name: "Test Co", Domain: "test.co"})

	seedQuestions(db, tenantID)

	var questions []models.Question
	db.Where("tenant_id = ?", tenantID).Find(&questions)

	for _, q := range questions {
		if q.Text == "" {
			t.Errorf("question %s has empty text", q.ID)
		}
		if q.Category == "" {
			t.Errorf("question %s has empty category", q.ID)
		}
		if q.ExpectedDuration <= 0 {
			t.Errorf("question %s has invalid expected_duration_sec: %d", q.ID, q.ExpectedDuration)
		}
		if q.TenantID != tenantID {
			t.Errorf("question %s has wrong tenant_id", q.ID)
		}
	}
}

func TestSeedQuestions_CoversExpectedCategories(t *testing.T) {
	db := newSeedDB(t)
	tenantID := uuid.New()
	db.Create(&models.Tenant{ID: tenantID, Name: "Test Co", Domain: "test.co"})

	seedQuestions(db, tenantID)

	expectedCategories := []string{"sales", "product", "communication", "objection_handling"}
	for _, cat := range expectedCategories {
		var count int64
		db.Model(&models.Question{}).Where("tenant_id = ? AND category = ?", tenantID, cat).Count(&count)
		if count == 0 {
			t.Errorf("expected at least one question in category %q, got 0", cat)
		}
	}
}

func TestResolveTenantID_UsesExistingTenant(t *testing.T) {
	db := newSeedDB(t)
	existing := models.Tenant{Name: "Existing Co", Domain: "existing.co"}
	db.Create(&existing)

	id := resolveTenantID(db)
	if id != existing.ID {
		t.Errorf("expected existing tenant ID %s, got %s", existing.ID, id)
	}
}

func TestResolveTenantID_CreatesDemoTenantIfNone(t *testing.T) {
	db := newSeedDB(t)

	id := resolveTenantID(db)
	if id == uuid.Nil {
		t.Error("expected a valid UUID for the created demo tenant")
	}

	var count int64
	db.Model(&models.Tenant{}).Count(&count)
	if count != 1 {
		t.Errorf("expected 1 tenant to be created, got %d", count)
	}
}

func TestDemoQuestions_NoneHaveEmptyFields(t *testing.T) {
	for i, q := range demoQuestions {
		if q.Text == "" {
			t.Errorf("demoQuestions[%d] has empty text", i)
		}
		if q.Category == "" {
			t.Errorf("demoQuestions[%d] has empty category", i)
		}
		if q.ExpectedDuration <= 0 {
			t.Errorf("demoQuestions[%d] has invalid expected_duration: %d", i, q.ExpectedDuration)
		}
	}
}
