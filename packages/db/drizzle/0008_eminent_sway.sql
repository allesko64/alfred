ALTER TABLE "ai_reviews" ADD COLUMN "is_large_pr" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_reviews" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_reviews" ADD COLUMN "resolved_from_previous" jsonb;--> statement-breakpoint
ALTER TABLE "ai_reviews" ADD COLUMN "criteria_coverage" jsonb;--> statement-breakpoint
ALTER TABLE "review_issues" ADD COLUMN "carried_over_from_review_number" integer;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD COLUMN "scheduled_at" timestamp;