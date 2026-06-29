ALTER TYPE "public"."workflow_type" ADD VALUE 'changelog_generation';--> statement-breakpoint
CREATE TABLE "changelog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"feature_id" uuid NOT NULL,
	"version" text NOT NULL,
	"entry" text NOT NULL,
	"type" "changelog_type" DEFAULT 'feature' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "changelog" ADD CONSTRAINT "changelog_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog" ADD CONSTRAINT "changelog_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "changelog_workspace_idx" ON "changelog" USING btree ("workspace_id");