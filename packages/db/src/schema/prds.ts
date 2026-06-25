import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { clarificationRoleEnum } from "./enums";
import { features } from "./features";

export const clarificationMessages = pgTable("clarification_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  featureId: uuid("feature_id")
    .notNull()
    .references(() => features.id, { onDelete: "cascade" }),
  role: clarificationRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const prds = pgTable("prds", {
  id: uuid("id").primaryKey().defaultRandom(),
  featureId: uuid("feature_id")
    .notNull()
    .unique()
    .references(() => features.id),
  problemStatement: text("problem_statement"),
  goals: jsonb("goals"),
  nonGoals: jsonb("non_goals"),
  userStories: jsonb("user_stories"),
  acceptanceCriteria: jsonb("acceptance_criteria"),
  edgeCases: jsonb("edge_cases"),
  successMetrics: jsonb("success_metrics"),
  rawContent: text("raw_content"),
  version: integer("version").notNull().default(1),
  generatedBy: text("generated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
