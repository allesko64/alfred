ALTER TABLE "workspaces" ADD COLUMN "credits_remaining" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "credits_reset_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "features" DROP COLUMN "ai_credits_used";