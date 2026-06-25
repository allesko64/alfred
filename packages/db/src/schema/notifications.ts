import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { features } from "./features";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  type: text("type").notNull(),
  title: text("title"),
  message: text("message"),
  isRead: boolean("is_read").notNull().default(false),
  featureId: uuid("feature_id").references(() => features.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
