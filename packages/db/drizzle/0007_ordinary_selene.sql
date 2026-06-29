ALTER TABLE "repositories" ADD COLUMN "last_webhook_at" timestamp;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "disconnected_at" timestamp;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD COLUMN "diff" text;