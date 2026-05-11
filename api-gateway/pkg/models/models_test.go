package models

import (
	"testing"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// newTestDB conecta a una DB real de test; se salta si no hay conexión disponible.
func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := "host=localhost user=postgres password=postgres dbname=jupiter_test port=5432 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Skip("postgres not available:", err)
	}
	if err := db.AutoMigrate(&Tenant{}, &User{}); err != nil {
		t.Fatalf("migration failed: %v", err)
	}
	return db
}

// --- Tenant ---

func TestTenant_BeforeCreate_AssignsUUID(t *testing.T) {
	tenant := &Tenant{}
	if err := tenant.BeforeCreate(nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tenant.ID == uuid.Nil {
		t.Error("expected UUID to be assigned, got nil")
	}
}

func TestTenant_BeforeCreate_PreservesExistingUUID(t *testing.T) {
	existing := uuid.New()
	tenant := &Tenant{ID: existing}
	_ = tenant.BeforeCreate(nil)
	if tenant.ID != existing {
		t.Errorf("expected ID to stay %s, got %s", existing, tenant.ID)
	}
}

// --- User ---

func TestUser_BeforeCreate_AssignsUUID(t *testing.T) {
	user := &User{}
	if err := user.BeforeCreate(nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if user.ID == uuid.Nil {
		t.Error("expected UUID to be assigned, got nil")
	}
}

func TestUser_BeforeCreate_PreservesExistingUUID(t *testing.T) {
	existing := uuid.New()
	user := &User{ID: existing}
	_ = user.BeforeCreate(nil)
	if user.ID != existing {
		t.Errorf("expected ID to stay %s, got %s", existing, user.ID)
	}
}

func TestRole_Constants(t *testing.T) {
	if RoleAdmin != "admin" {
		t.Errorf("expected RoleAdmin=admin, got %q", RoleAdmin)
	}
	if RoleMember != "member" {
		t.Errorf("expected RoleMember=member, got %q", RoleMember)
	}
}

// --- Integration (requiere postgres) ---

func TestUser_TenantIsolation(t *testing.T) {
	db := newTestDB(t)

	tenantA := &Tenant{Name: "company-a", Domain: "a.test"}
	tenantB := &Tenant{Name: "company-b", Domain: "b.test"}
	db.Create(tenantA)
	db.Create(tenantB)

	db.Create(&User{TenantID: tenantA.ID, Email: "alice@a.test", PasswordHash: "x", Role: RoleAdmin})
	db.Create(&User{TenantID: tenantB.ID, Email: "bob@b.test", PasswordHash: "x", Role: RoleMember})

	var users []User
	db.Where("tenant_id = ?", tenantA.ID).Find(&users)

	if len(users) != 1 {
		t.Errorf("expected 1 user for tenantA, got %d", len(users))
	}
	if users[0].Email != "alice@a.test" {
		t.Errorf("unexpected user: %s", users[0].Email)
	}

	// cleanup
	db.Where("tenant_id IN ?", []uuid.UUID{tenantA.ID, tenantB.ID}).Delete(&User{})
	db.Delete(tenantA)
	db.Delete(tenantB)
}
