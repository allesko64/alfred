import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { features } from "./features";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title"),
    message: text("message"),
    isRead: boolean("is_read").notNull().default(false),
    featureId: uuid("feature_id").references(() => features.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_idx").on(table.userId),
    index("notifications_workspace_idx").on(table.workspaceId),
    index("notifications_feature_idx").on(table.featureId),
  ],
);
