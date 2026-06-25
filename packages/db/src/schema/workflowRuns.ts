import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { workflowStatusEnum, workflowTypeEnum } from "./enums";
import { features } from "./features";

export const workflowRuns = pgTable("workflow_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  featureId: uuid("feature_id")
    .notNull()
    .references(() => features.id),
  workflowType: workflowTypeEnum("workflow_type").notNull(),
  inngestRunId: text("inngest_run_id"),
  status: workflowStatusEnum("status").notNull().default("pending"),
  progressMessage: text("progress_message"),
  progressPercent: integer("progress_percent").notNull().default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
