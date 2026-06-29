import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { issueSeverityEnum, prStatusEnum, reviewStatusEnum } from "./enums";
import { features } from "./features";
import { repositories } from "./projects";

export const pullRequests = pgTable("pull_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  featureId: uuid("feature_id").references(() => features.id),
  repositoryId: uuid("repository_id")
    .notNull()
    .references(() => repositories.id),
  githubPrId: bigint("github_pr_id", { mode: "number" }).notNull().unique(),
  githubPrNumber: integer("github_pr_number"),
  title: text("title"),
  body: text("body"),
  author: text("author"),
  headBranch: text("head_branch"),
  baseBranch: text("base_branch"),
  diffUrl: text("diff_url"),
  diff: text("diff"),
  status: prStatusEnum("status").notNull().default("OPEN"),
  mergedAt: timestamp("merged_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiReviews = pgTable("ai_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  featureId: uuid("feature_id")
    .notNull()
    .references(() => features.id),
  pullRequestId: uuid("pull_request_id")
    .notNull()
    .references(() => pullRequests.id),
  reviewNumber: integer("review_number").notNull().default(1),
  status: reviewStatusEnum("status").notNull().default("PENDING"),
  summary: text("summary"),
  blockingCount: integer("blocking_count").notNull().default(0),
  nonBlockingCount: integer("non_blocking_count").notNull().default(0),
  githubCommentId: bigint("github_comment_id", { mode: "number" }),
  modelUsed: text("model_used"),
  tokensUsed: integer("tokens_used"),
  isLargePR: boolean("is_large_pr").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  resolvedFromPrevious: jsonb("resolved_from_previous"),
  criteriaCoverage: jsonb("criteria_coverage"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reviewIssues = pgTable("review_issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  reviewId: uuid("review_id")
    .notNull()
    .references(() => aiReviews.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  severity: issueSeverityEnum("severity").notNull().default("NON_BLOCKING"),
  filePath: text("file_path"),
  lineNumber: integer("line_number"),
  prdRequirementViolated: text("prd_requirement_violated"),
  suggestedFix: text("suggested_fix"),
  isResolved: boolean("is_resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  carriedOverFromReviewNumber: integer("carried_over_from_review_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
