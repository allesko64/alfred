ALTER TABLE "clarification_messages" ADD COLUMN "options" jsonb;--> statement-breakpoint
ALTER TABLE "prds" ADD COLUMN "assumptions" jsonb;--> statement-breakpoint
ALTER TABLE "prds" ADD COLUMN "scope_warning" text;