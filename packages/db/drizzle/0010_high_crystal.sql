ALTER TABLE "users" ADD COLUMN "digest_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "digest_hour_local" integer DEFAULT 9 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "digest_timezone" text DEFAULT 'UTC' NOT NULL;