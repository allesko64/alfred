import { TRPCError } from "@trpc/server";
import { createFeatureSchema, submitClarificationReplySchema } from "@alfred/validators";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { clarificationMessages, features, users, workflowRuns } from "@alfred/db";
import { inngest } from "@alfred/inngest";
import { createTRPCRouter, workspaceInputSchema, workspaceProcedure } from "../trpc";

const PIPELINE_STAGES = [
  { key: "draft", label: "Draft", statuses: ["DRAFT"] },
  { key: "clarifying", label: "Clarifying", statuses: ["CLARIFYING"] },
  { key: "prd_ready", label: "PRD Ready", statuses: ["PRD_READY"] },
  { key: "in_development", label: "In Development", statuses: ["IN_DEVELOPMENT"] },
  { key: "in_review", label: "In Review", statuses: ["REVIEWING", "RE_REVIEWING"] },
  { key: "shipped", label: "Shipped", statuses: ["SHIPPED"] },
] as const;

export const featureRouter = createTRPCRouter({
  create: workspaceProcedure
    .input(createFeatureSchema)
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .insert(features)
        .values({
          workspaceId: ctx.workspaceId,
          projectId: input.projectId,
          title: input.content.slice(0, 60),
          originalRequest: input.content,
          status: "CLARIFYING",
          createdBy: ctx.user.id,
        })
        .returning();

      if (!feature) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      await ctx.db.insert(clarificationMessages).values({
        featureId: feature.id,
        role: "user",
        content: input.content,
      });

      await inngest.send({
        name: "feature/clarification.requested",
        data: { featureId: feature.id },
      });

      return feature;
    }),

  submitClarificationReply: workspaceProcedure
    .input(submitClarificationReplySchema.extend({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.db.insert(clarificationMessages).values({
        featureId: input.featureId,
        role: "user",
        content: input.content,
      });

      await inngest.send({
        name: "feature/clarification.requested",
        data: { featureId: input.featureId },
      });

      return { ok: true };
    }),

  getClarificationMessages: workspaceProcedure
    .input(z.object({ workspaceId: z.string().uuid(), featureId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.db
        .select()
        .from(clarificationMessages)
        .where(eq(clarificationMessages.featureId, input.featureId))
        .orderBy(asc(clarificationMessages.createdAt));
    }),

  getWorkflowProgress: workspaceProcedure
    .input(z.object({ workspaceId: z.string().uuid(), featureId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [run] = await ctx.db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.featureId, input.featureId))
        .orderBy(desc(workflowRuns.createdAt))
        .limit(1);

      return run ?? null;
    }),

  list: workspaceProcedure.input(workspaceInputSchema).query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(features)
      .where(eq(features.workspaceId, ctx.workspaceId))
      .orderBy(desc(features.updatedAt));
  }),

  getById: workspaceProcedure
    .input(z.object({ workspaceId: z.string().uuid(), featureId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          feature: features,
          createdByName: users.name,
          createdByEmail: users.email,
        })
        .from(features)
        .innerJoin(users, eq(users.id, features.createdBy))
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return { ...row.feature, createdByName: row.createdByName, createdByEmail: row.createdByEmail };
    }),

  getStatusCounts: workspaceProcedure.input(workspaceInputSchema).query(async ({ ctx }) => {
    return ctx.db
      .select({ status: features.status, count: sql<number>`count(*)::int` })
      .from(features)
      .where(eq(features.workspaceId, ctx.workspaceId))
      .groupBy(features.status);
  }),

  /** The 6-stage pipeline shown on the dashboard (a curated view, not a 1:1 status dump). */
  getPipelineCounts: workspaceProcedure.input(workspaceInputSchema).query(async ({ ctx }) => {
    const statusCounts = await ctx.db
      .select({ status: features.status, count: sql<number>`count(*)::int` })
      .from(features)
      .where(eq(features.workspaceId, ctx.workspaceId))
      .groupBy(features.status);

    return PIPELINE_STAGES.map((stage) => ({
      key: stage.key,
      label: stage.label,
      statuses: stage.statuses,
      count: statusCounts
        .filter((row) => (stage.statuses as readonly string[]).includes(row.status))
        .reduce((sum, row) => sum + row.count, 0),
    }));
  }),

  getRecent: workspaceProcedure.input(workspaceInputSchema).query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: features.id,
        title: features.title,
        status: features.status,
        updatedAt: features.updatedAt,
        createdByName: users.name,
        createdByEmail: users.email,
      })
      .from(features)
      .innerJoin(users, eq(users.id, features.createdBy))
      .where(eq(features.workspaceId, ctx.workspaceId))
      .orderBy(desc(features.updatedAt))
      .limit(5);
  }),
});
