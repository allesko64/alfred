ALTER TABLE "features" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "features" ADD COLUMN "share_token_created_at" timestamp;--> statement-breakpoint
ALTER TABLE "features" ADD COLUMN "share_token_revoked_at" timestamp;--> statement-breakpoint
CREATE INDEX "features_share_token_idx" ON "features" USING btree ("share_token");--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_share_token_unique" UNIQUE("share_token");