ALTER TABLE "workspace_memberships" DROP CONSTRAINT "workspace_memberships_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_memberships" DROP CONSTRAINT "workspace_memberships_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_memberships" DROP CONSTRAINT "workspace_memberships_invited_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "workspaces" DROP CONSTRAINT "workspaces_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "repositories" DROP CONSTRAINT "repositories_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "repositories" DROP CONSTRAINT "repositories_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "features" DROP CONSTRAINT "features_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "features" DROP CONSTRAINT "features_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "features" DROP CONSTRAINT "features_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "features" DROP CONSTRAINT "features_assigned_to_users_id_fk";
--> statement-breakpoint
ALTER TABLE "features" DROP CONSTRAINT "features_approved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "prds" DROP CONSTRAINT "prds_feature_id_features_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_assigned_to_users_id_fk";
--> statement-breakpoint
ALTER TABLE "ai_reviews" DROP CONSTRAINT "ai_reviews_feature_id_features_id_fk";
--> statement-breakpoint
ALTER TABLE "ai_reviews" DROP CONSTRAINT "ai_reviews_pull_request_id_pull_requests_id_fk";
--> statement-breakpoint
ALTER TABLE "pull_requests" DROP CONSTRAINT "pull_requests_feature_id_features_id_fk";
--> statement-breakpoint
ALTER TABLE "pull_requests" DROP CONSTRAINT "pull_requests_repository_id_repositories_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_feature_id_features_id_fk";
--> statement-breakpoint
ALTER TABLE "billing_subscriptions" DROP CONSTRAINT "billing_subscriptions_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_invites" DROP CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_invites" DROP CONSTRAINT "workspace_invites_invited_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "code_chunks" DROP CONSTRAINT "code_chunks_repository_id_repositories_id_fk";
--> statement-breakpoint
ALTER TABLE "code_chunks" DROP CONSTRAINT "code_chunks_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "workflow_runs" DROP CONSTRAINT "workflow_runs_feature_id_features_id_fk";
--> statement-breakpoint
ALTER TABLE "changelog" DROP CONSTRAINT "changelog_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "changelog" DROP CONSTRAINT "changelog_feature_id_features_id_fk";
--> statement-breakpoint
ALTER TABLE "features" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "features" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::text;--> statement-breakpoint
DROP TYPE "public"."feature_status";--> statement-breakpoint
CREATE TYPE "public"."feature_status" AS ENUM('DRAFT', 'CLARIFYING', 'PRD_GENERATION', 'PRD_READY', 'TASK_GENERATION', 'PLANNING', 'IN_DEVELOPMENT', 'PR_LINKED', 'REVIEWING', 'CHANGES_REQUESTED', 'RE_REVIEWING', 'REVIEW_PASSED', 'PENDING_APPROVAL', 'SHIPPED', 'REJECTED');--> statement-breakpoint
ALTER TABLE "features" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"public"."feature_status";--> statement-breakpoint
ALTER TABLE "features" ALTER COLUMN "status" SET DATA TYPE "public"."feature_status" USING "status"::"public"."feature_status";--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "webhook_secret" text;--> statement-breakpoint
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prds" ADD CONSTRAINT "prds_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_pull_request_id_pull_requests_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_chunks" ADD CONSTRAINT "code_chunks_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_chunks" ADD CONSTRAINT "code_chunks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog" ADD CONSTRAINT "changelog_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog" ADD CONSTRAINT "changelog_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clarification_messages_feature_idx" ON "clarification_messages" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "tasks_workspace_idx" ON "tasks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ai_reviews_feature_idx" ON "ai_reviews" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "ai_reviews_pull_request_idx" ON "ai_reviews" USING btree ("pull_request_id");--> statement-breakpoint
CREATE INDEX "pull_requests_feature_idx" ON "pull_requests" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "pull_requests_repository_idx" ON "pull_requests" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "review_issues_review_idx" ON "review_issues" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_workspace_idx" ON "notifications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "notifications_feature_idx" ON "notifications" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "workflow_runs_feature_idx" ON "workflow_runs" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "workflow_runs_feature_type_idx" ON "workflow_runs" USING btree ("feature_id","workflow_type");--> statement-breakpoint
CREATE INDEX "changelog_feature_idx" ON "changelog" USING btree ("feature_id");