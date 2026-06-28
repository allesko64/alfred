CREATE TYPE "public"."onboarding_step" AS ENUM('team', 'complete');--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "onboarding_step" "onboarding_step" DEFAULT 'team' NOT NULL;