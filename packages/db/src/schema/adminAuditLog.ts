import { jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const adminAuditActionEnum = pgEnum("admin_audit_action", [
  "plan_change",
  "credit_adjustment",
]);

export const adminAuditLog = pgTable("admin_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminUserId: uuid("admin_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  action: adminAuditActionEnum("action").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
