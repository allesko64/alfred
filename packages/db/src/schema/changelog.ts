import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { changelogTypeEnum } from "./enums";
import { features } from "./features";
import { workspaces } from "./workspaces";

export const changelog = pgTable(
  "changelog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    featureId: uuid("feature_id")
      .notNull()
      .references(() => features.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    entry: text("entry").notNull(),
    type: changelogTypeEnum("type").notNull().default("feature"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("changelog_workspace_idx").on(table.workspaceId),
    index("changelog_feature_idx").on(table.featureId),
  ],
);
