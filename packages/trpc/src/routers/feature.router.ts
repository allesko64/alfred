import { TRPCError } from "@trpc/server";
import { createFeatureSchema } from "@alfred/validators";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { clarificationMessages, features } from "@alfred/db";
import { createTRPCRouter, workspaceProcedure } from "../trpc";

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

  list: workspaceProcedure.query(async ({ ctx }) => {
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

  getStatusCounts: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({ status: features.status, count: sql<number>`count(*)::int` })
      .from(features)
      .where(eq(features.workspaceId, ctx.workspaceId))
      .groupBy(features.status);
  }),
});
