ALTER TABLE "workflow_runs" ALTER COLUMN "feature_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD COLUMN "repository_id" uuid;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_runs_repository_type_idx" ON "workflow_runs" USING btree ("repository_id","workflow_type");