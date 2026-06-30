import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { workflowStatusEnum, workflowTypeEnum } from "./enums";
import { features } from "./features";
import { repositories } from "./projects";

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null for repository-scoped workflows (e.g. repo_vectorization) — see repositoryId. */
    featureId: uuid("feature_id").references(() => features.id, {
      onDelete: "cascade",
    }),
    /** Set instead of featureId for repository-scoped workflows. */
    repositoryId: uuid("repository_id").references(() => repositories.id, {
      onDelete: "cascade",
    }),
    workflowType: workflowTypeEnum("workflow_type").notNull(),
    inngestRunId: text("inngest_run_id"),
    status: workflowStatusEnum("status").notNull().default("pending"),
    progressMessage: text("progress_message"),
    progressPercent: integer("progress_percent").notNull().default(0),
    errorMessage: text("error_message"),
    scheduledAt: timestamp("scheduled_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("workflow_runs_feature_idx").on(table.featureId),
    index("workflow_runs_feature_type_idx").on(
      table.featureId,
      table.workflowType,
    ),
    index("workflow_runs_repository_type_idx").on(
      table.repositoryId,
      table.workflowType,
    ),
  ],
);
