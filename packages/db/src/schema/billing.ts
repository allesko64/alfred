import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { billingStatusEnum, workspacePlanEnum } from "./enums";
import { workspaces } from "./workspaces";

export const billingSubscriptions = pgTable("billing_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  razorpayCustomerId: text("razorpay_customer_id"),
  plan: workspacePlanEnum("plan").notNull().default("free"),
  status: billingStatusEnum("status").notNull().default("active"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
