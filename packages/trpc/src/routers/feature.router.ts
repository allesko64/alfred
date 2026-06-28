import { TRPCError } from "@trpc/server";
import { createFeatureSchema } from "@alfred/validators";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { clarificationMessages, features, users } from "@alfred/db";
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
          title: input.title,
          originalRequest: input.description,
          createdBy: ctx.user.id,
        })
        .returning();

      if (!feature) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      await ctx.db.insert(clarificationMessages).values({
        featureId: feature.id,
        role: "user",
        content: input.description,
      });

      return feature;
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
      const [feature] = await ctx.db
        .select()
        .from(features)
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return feature;
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
