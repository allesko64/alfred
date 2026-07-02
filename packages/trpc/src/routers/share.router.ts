import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { featureInputSchema, getPublicShareSchema } from "@alfred/validators";
import { and, eq, isNull } from "drizzle-orm";
import { features, prds, tasks, PRE_DEVELOPMENT_STATUSES } from "@alfred/db";
import { createTRPCRouter, publicProcedure, workspaceProcedure } from "../trpc";

export const shareRouter = createTRPCRouter({
  /** Returns the feature's existing (non-revoked) share token, or mints one. */
  getOrCreate: workspaceProcedure
    .input(featureInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ shareToken: features.shareToken, shareTokenRevokedAt: features.shareTokenRevokedAt })
        .from(features)
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (feature.shareToken && !feature.shareTokenRevokedAt) {
        return { token: feature.shareToken };
      }

      const token = randomUUID();

      await ctx.db
        .update(features)
        .set({ shareToken: token, shareTokenCreatedAt: new Date(), shareTokenRevokedAt: null })
        .where(eq(features.id, input.featureId));

      return { token };
    }),

  revoke: workspaceProcedure
    .input(featureInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .update(features)
        .set({ shareTokenRevokedAt: new Date() })
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .returning({ id: features.id });

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return { ok: true };
    }),

  /**
   * No auth — this is the public share page's data source. Only ever
   * selects the specific columns a stakeholder outside the workspace should
   * see; PRD/tasks are included only once the corresponding approval gate
   * has actually been passed, mirroring the in-app "Share" button's own
   * visibility rules.
   */
  getPublic: publicProcedure
    .input(getPublicShareSchema)
    .query(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({
          id: features.id,
          title: features.title,
          status: features.status,
          approvedAt: features.approvedAt,
          decisionPills: features.decisionPills,
        })
        .from(features)
        .where(and(eq(features.shareToken, input.token), isNull(features.shareTokenRevokedAt)))
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const isPrdApproved = !!feature.approvedAt;
      const isPlanApproved = !PRE_DEVELOPMENT_STATUSES.includes(
        feature.status as (typeof PRE_DEVELOPMENT_STATUSES)[number],
      );

      const prd = isPrdApproved
        ? await ctx.db
            .select({
              problemStatement: prds.problemStatement,
              goals: prds.goals,
              nonGoals: prds.nonGoals,
              userStories: prds.userStories,
              acceptanceCriteria: prds.acceptanceCriteria,
              assumptions: prds.assumptions,
            })
            .from(prds)
            .where(eq(prds.featureId, feature.id))
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : null;

      const taskList = isPlanApproved
        ? await ctx.db
            .select({
              id: tasks.id,
              title: tasks.title,
              description: tasks.description,
              status: tasks.status,
              priority: tasks.priority,
            })
            .from(tasks)
            .where(eq(tasks.featureId, feature.id))
            .orderBy(tasks.position)
        : [];

      return {
        title: feature.title,
        decisionPills: feature.decisionPills ?? [],
        prd,
        tasks: taskList,
      };
    }),
});
