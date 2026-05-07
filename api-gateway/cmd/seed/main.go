package main

import (
	"log"
	"os"

	"github.com/Jupiter-riwi/jupiter/api-gateway/internal/database"
	"github.com/Jupiter-riwi/jupiter/api-gateway/pkg/models"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var demoQuestions = []struct {
	Text             string
	Category         string
	ExpectedDuration int
}{
	// Sales
	{"What is your product's main value proposition?", "sales", 90},
	{"How do you handle a prospect who says the price is too high?", "sales", 120},
	{"Describe your approach to closing a deal under time pressure.", "sales", 90},
	{"How do you qualify a lead in the first 5 minutes of a call?", "sales", 60},
	{"Walk us through a recent win and what made it successful.", "sales", 120},

	// Product
	{"How would you explain our product to a non-technical customer?", "product", 90},
	{"What are the top three differentiators vs. our main competitor?", "product", 120},
	{"How do you address a customer who asks for a feature we don't have?", "product", 90},
	{"Describe the onboarding experience for a new enterprise customer.", "product", 120},

	// Communication
	{"Tell me about yourself and your sales background.", "communication", 60},
	{"How do you build rapport with a skeptical buyer?", "communication", 90},
	{"Give an example of how you turned a no into a yes.", "communication", 120},

	// Objection handling
	{"How do you respond when a prospect says they need to think about it?", "objection_handling", 90},
	{"A customer says your competitor offers the same thing for less. What do you say?", "objection_handling", 120},
	{"How do you handle a stalled deal that has gone cold?", "objection_handling", 90},
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	db, err := database.Connect()
	if err != nil {
		log.Fatal("failed to connect to database:", err)
	}

	tenantID := resolveTenantID(db)

	seeded := seedQuestions(db, tenantID)
	log.Printf("Seed complete: %d questions upserted for tenant %s", seeded, tenantID)
}

// resolveTenantID uses SEED_TENANT_ID env var or the first existing tenant,
// creating a demo tenant if none exists.
func resolveTenantID(db *gorm.DB) uuid.UUID {
	if raw := os.Getenv("SEED_TENANT_ID"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			log.Fatalf("invalid SEED_TENANT_ID: %v", err)
		}
		return id
	}

	var tenant models.Tenant
	if err := db.First(&tenant).Error; err == nil {
		log.Printf("Using existing tenant: %s (%s)", tenant.Name, tenant.ID)
		return tenant.ID
	}

	tenant = models.Tenant{Name: "Demo Company", Domain: "demo.jupiter.ai"}
	if err := db.Create(&tenant).Error; err != nil {
		log.Fatal("failed to create demo tenant:", err)
	}
	log.Printf("Created demo tenant: %s (%s)", tenant.Name, tenant.ID)
	return tenant.ID
}

func seedQuestions(db *gorm.DB, tenantID uuid.UUID) int {
	questions := make([]models.Question, len(demoQuestions))
	for i, q := range demoQuestions {
		questions[i] = models.Question{
			TenantID:         tenantID,
			Text:             q.Text,
			Category:         q.Category,
			ExpectedDuration: q.ExpectedDuration,
		}
	}

	// Upsert: skip duplicates based on (tenant_id, text)
	result := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&questions)
	if result.Error != nil {
		log.Fatal("seed failed:", result.Error)
	}

	return int(result.RowsAffected)
}
