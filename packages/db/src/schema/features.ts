import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    originalRequest: text("original_request").notNull(),
    status: featureStatusEnum("status").notNull().default("DRAFT"),
    /** 3-4 short noun-phrase summaries of key decisions from clarification, e.g. "Toggle in navbar". Generated once alongside the title, reused in the confirmed transcript and the PRD "Planning against" header. */
    decisionPills: jsonb("decision_pills").$type<string[]>(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedTo: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedBy: uuid("approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at"),
    shippedAt: timestamp("shipped_at"),
    rejectedAt: timestamp("rejected_at"),
    rejectionReason: text("rejection_reason"),
    /**
     * Unguessable token for the public read-only share page
     * (`/share/[token]`). One token per feature, covering both the PRD and
     * kanban views — each view is gated independently on the public route by
     * the feature's current approval state, not by separate tokens.
     */
    shareToken: text("share_token").unique(),
    shareTokenCreatedAt: timestamp("share_token_created_at"),
    shareTokenRevokedAt: timestamp("share_token_revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("features_workspace_idx").on(table.workspaceId),
    index("features_status_idx").on(table.status),
    index("features_project_idx").on(table.projectId),
    index("features_share_token_idx").on(table.shareToken),
  ],
);
