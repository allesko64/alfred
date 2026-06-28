import { pgEnum } from "drizzle-orm/pg-core";

export const workspacePlanEnum = pgEnum("workspace_plan", [
  "free",
  "pro",
  "team",
]);

export const billingStatusEnum = pgEnum("billing_status", [
  "active",
  "past_due",
  "cancelled",
  "trialing",
]);

export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "admin",
  "developer",
  "reviewer",
  "viewer",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "active",
  "pending",
]);

export const onboardingStepEnum = pgEnum("onboarding_step", [
  "team",
  "complete",
]);

export const featureStatusEnum = pgEnum("feature_status", [
  "DRAFT",
  "CLARIFYING",
  "PRD_GENERATION",
  "PRD_READY",
  "TASK_GENERATION",
  "PLANNING",
  "IN_DEVELOPMENT",
  "PR_LINKED",
  "REVIEWING",
  "CHANGES_REQUESTED",
  "RE_REVIEWING",
  "REVIEW_PASSED",
  "PENDING_APPROVAL",
  "APPROVED",
  "SHIPPED",
  "REJECTED",
]);

export const clarificationRoleEnum = pgEnum("clarification_role", [
  "user",
  "alfred",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "TODO",
  "IN_PROGRESS",
  "DONE",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);

export const prStatusEnum = pgEnum("pr_status", ["OPEN", "CLOSED", "MERGED"]);

export const reviewStatusEnum = pgEnum("review_status", [
  "PENDING",
  "IN_PROGRESS",
  "PASSED",
  "FAILED",
]);

export const issueSeverityEnum = pgEnum("issue_severity", [
  "BLOCKING",
  "NON_BLOCKING",
]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "expired",
]);

export const changelogTypeEnum = pgEnum("changelog_type", [
  "feature",
  "fix",
  "improvement",
]);

export const workflowTypeEnum = pgEnum("workflow_type", [
  "prd_generation",
  "task_generation",
  "pr_ingestion",
  "ai_review",
  "re_review",
  "release_readiness",
  "repo_vectorization",
]);

export const workflowStatusEnum = pgEnum("workflow_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);
