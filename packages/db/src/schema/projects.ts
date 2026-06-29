import {
  bigint,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    githubRepoId: bigint("github_repo_id", { mode: "number" }).notNull().unique(),
    fullName: text("full_name").notNull(),
    owner: text("owner"),
    name: text("name"),
    defaultBranch: text("default_branch"),
    webhookId: bigint("webhook_id", { mode: "number" }),
    installationId: bigint("installation_id", { mode: "number" }).notNull(),
    isIndexed: boolean("is_indexed").notNull().default(false),
    indexedAt: timestamp("indexed_at"),
    lastWebhookAt: timestamp("last_webhook_at"),
    disconnectedAt: timestamp("disconnected_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("repositories_workspace_idx").on(table.workspaceId),
    index("repositories_github_repo_id_idx").on(table.githubRepoId),
    index("repositories_installation_id_idx").on(table.installationId),
  ],
);
