import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { featureStatusEnum } from "./enums";
import { projects } from "./projects";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const features = pgTable(
  "features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    projectId: uuid("project_id").references(() => projects.id),
    title: text("title").notNull(),
    originalRequest: text("original_request").notNull(),
    status: featureStatusEnum("status").notNull().default("DRAFT"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    assignedTo: uuid("assigned_to").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at"),
    shippedAt: timestamp("shipped_at"),
    rejectedAt: timestamp("rejected_at"),
    rejectionReason: text("rejection_reason"),
    aiCreditsUsed: integer("ai_credits_used").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("features_workspace_idx").on(table.workspaceId),
    index("features_status_idx").on(table.status),
    index("features_project_idx").on(table.projectId),
  ],
);
