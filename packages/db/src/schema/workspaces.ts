import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  billingStatusEnum,
  membershipRoleEnum,
  membershipStatusEnum,
  onboardingStepEnum,
  workspacePlanEnum,
} from "./enums";
import { users } from "./users";

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  plan: workspacePlanEnum("plan").notNull().default("free"),
  billingStatus: billingStatusEnum("billing_status").notNull().default("active"),
  onboardingStep: onboardingStepEnum("onboarding_step").notNull().default("team"),
  buildingType: text("building_type"),
  /** AI credit balance for the current monthly cycle. Resets via cron and on plan change — see billing-limits.ts. */
  creditsRemaining: integer("credits_remaining").notNull().default(100),
  creditsResetAt: timestamp("credits_reset_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    role: membershipRoleEnum("role").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id),
    status: membershipStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("workspace_memberships_user_workspace_idx").on(
      table.userId,
      table.workspaceId,
    ),
    uniqueIndex("workspace_memberships_user_workspace_unique").on(
      table.userId,
      table.workspaceId,
    ),
  ],
);
