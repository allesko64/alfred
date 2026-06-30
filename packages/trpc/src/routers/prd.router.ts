import { TRPCError } from "@trpc/server";
import { approvePRDSchema, createPRDSchema } from "@alfred/validators";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { checkAndDeductCredits, features, prds } from "@alfred/db";
import { inngest } from "@alfred/inngest";
import { createTRPCRouter, workspaceProcedure } from "../trpc";

export const prdRouter = createTRPCRouter({
  getByFeature: workspaceProcedure
    .input(z.object({ workspaceId: z.string().uuid(), featureId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ prd: prds })
        .from(prds)
        .innerJoin(features, eq(features.id, prds.featureId))
        .where(and(eq(prds.featureId, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return row.prd;
    }),

  create: workspaceProcedure
    .input(createPRDSchema.extend({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [prd] = await ctx.db
        .insert(prds)
        .values({
          featureId: input.featureId,
          problemStatement: input.problemStatement,
          goals: input.goals,
          nonGoals: input.nonGoals,
          userStories: input.userStories,
          acceptanceCriteria: input.acceptanceCriteria,
          assumptions: input.assumptions,
          scopeWarning: input.scopeWarning,
          rawContent: input.rawContent,
          generatedBy: input.generatedBy,
        })
        .returning();

      await ctx.db
        .update(features)
        .set({ status: "PRD_READY", updatedAt: new Date() })
        .where(eq(features.id, input.featureId));

      return prd;
    }),

  approve: workspaceProcedure
    .input(approvePRDSchema.extend({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const credits = await checkAndDeductCredits(ctx.workspaceId, "task_generation");
      if (!credits.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You're out of AI credits. Upgrade or wait for your next monthly reset.",
        });
      }

      await ctx.db
        .update(features)
        .set({
          status: "TASK_GENERATION",
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(features.id, input.featureId));

      await inngest.send({
        name: "feature/task-generation.requested",
        data: { featureId: input.featureId },
      });

      return { ok: true };
    }),
});
