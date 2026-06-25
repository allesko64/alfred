import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { inviteStatusEnum, membershipRoleEnum } from "./enums";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const workspaceInvites = pgTable("workspace_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => users.id),
  githubUsername: text("github_username"),
  email: text("email"),
  role: membershipRoleEnum("role").notNull(),
  token: text("token").notNull().unique(),
  status: inviteStatusEnum("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
