import { TRPCError } from "@trpc/server";
import {
  type BillingLimitType,
  billingSubscriptions,
  checkBillingLimit,
  getCreditsStatus,
  workspaces,
} from "@alfred/db";
import { eq } from "drizzle-orm";
import { paidPlanSchema } from "@alfred/validators";
import { createTRPCRouter, requireWorkspaceRole, workspaceInputSchema, workspaceProcedure } from "../trpc";
import { getRazorpayClient, getRazorpayPlanId, type PaidPlan } from "../lib/razorpay";

const USAGE_TYPES: BillingLimitType[] = ["repos", "members"];

/** Razorpay subscriptions require a fixed total_count — 12 monthly cycles, renewed by re-subscribing. */
const SUBSCRIPTION_TOTAL_COUNT = 12;

export const billingRouter = createTRPCRouter({
  getSubscription: workspaceProcedure.input(workspaceInputSchema).query(async ({ ctx }) => {
    const [workspace] = await ctx.db
      .select({ plan: workspaces.plan, billingStatus: workspaces.billingStatus })
      .from(workspaces)
      .where(eq(workspaces.id, ctx.workspaceId))
      .limit(1);

    const [subscription] = await ctx.db
      .select()
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.workspaceId, ctx.workspaceId))
      .limit(1);

    return { workspace, subscription: subscription ?? null };
  }),

  /** Usage vs. plan limits for every gated resource — drives the billing page's usage meters. */
  getUsage: workspaceProcedure.input(workspaceInputSchema).query(async ({ ctx }) => {
    const [results, credits] = await Promise.all([
      Promise.all(USAGE_TYPES.map((type) => checkBillingLimit(ctx.workspaceId, type))),
      getCreditsStatus(ctx.workspaceId),
    ]);

    return {
      credits: { current: credits.limit - credits.remaining, limit: credits.limit },
      ...Object.fromEntries(USAGE_TYPES.map((type, i) => [type, results[i]])),
    };
  }),

  /** Creates (or reuses) a Razorpay customer + subscription and returns the hosted checkout URL. */
  createCheckoutSession: workspaceProcedure
    .use(requireWorkspaceRole(["owner", "admin"]))
    .input(workspaceInputSchema.extend({ plan: paidPlanSchema }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const plan = input.plan as PaidPlan;
      const razorpay = getRazorpayClient();

      const [existing] = await ctx.db
        .select({ razorpayCustomerId: billingSubscriptions.razorpayCustomerId })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.workspaceId, ctx.workspaceId))
        .limit(1);

      const customerId =
        existing?.razorpayCustomerId ??
        (
          await razorpay.customers.create({
            name: ctx.user.name ?? ctx.user.email,
            email: ctx.user.email,
            notes: { workspaceId: ctx.workspaceId },
          })
        ).id;

      const subscription = await razorpay.subscriptions.create({
        plan_id: getRazorpayPlanId(plan),
        customer_notify: 1,
        total_count: SUBSCRIPTION_TOTAL_COUNT,
        notes: { workspaceId: ctx.workspaceId, plan },
      });

      await ctx.db
        .insert(billingSubscriptions)
        .values({
          workspaceId: ctx.workspaceId,
          razorpaySubscriptionId: subscription.id,
          razorpayCustomerId: customerId,
          plan,
          status: "trialing",
        })
        .onConflictDoUpdate({
          target: billingSubscriptions.workspaceId,
          set: { razorpaySubscriptionId: subscription.id, razorpayCustomerId: customerId, plan, status: "trialing" },
        });

      const checkoutUrl = subscription.short_url;
      if (!checkoutUrl) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Razorpay did not return a checkout URL" });
      }

      return { checkoutUrl };
    }),
});
