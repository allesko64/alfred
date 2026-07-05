import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { taskPriorityEnum, taskStatusEnum } from "./enums";
import { features } from "./features";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    featureId: uuid("feature_id")
      .notNull()
      .references(() => features.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("TODO"),
    priority: taskPriorityEnum("priority").notNull().default("MEDIUM"),
    assignedTo: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    estimatedHours: integer("estimated_hours"),
    position: integer("position"),
    // AI-generated coding-agent brief, filled by a fan-out step after task
    // generation. Null while generating (or if generation failed).
    implementationPrompt: text("implementation_prompt"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("tasks_feature_idx").on(table.featureId),
    index("tasks_status_idx").on(table.status),
    index("tasks_workspace_idx").on(table.workspaceId),
  ],
);
