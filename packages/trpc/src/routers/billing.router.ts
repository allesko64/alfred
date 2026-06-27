import { eq } from "drizzle-orm";
import { billingSubscriptions, workspaces } from "@alfred/db";
import { createTRPCRouter, workspaceProcedure } from "../trpc";

export const billingRouter = createTRPCRouter({
  getSubscription: workspaceProcedure.query(async ({ ctx }) => {
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
});
