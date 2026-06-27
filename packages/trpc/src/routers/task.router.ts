import { TRPCError } from "@trpc/server";
import { createTaskSchema, updateTaskStatusSchema } from "@alfred/validators";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { features, tasks } from "@alfred/db";
import { createTRPCRouter, workspaceProcedure } from "../trpc";

export const taskRouter = createTRPCRouter({
  getByFeature: workspaceProcedure
    .input(z.object({ workspaceId: z.string().uuid(), featureId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.featureId, input.featureId), eq(tasks.workspaceId, ctx.workspaceId)))
        .orderBy(tasks.position);
    }),

  create: workspaceProcedure
    .input(createTaskSchema.extend({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [task] = await ctx.db
        .insert(tasks)
        .values({
          featureId: input.featureId,
          workspaceId: ctx.workspaceId,
          title: input.title,
          description: input.description,
          priority: input.priority,
        })
        .returning();

      return task;
    }),

  updateStatus: workspaceProcedure
    .input(updateTaskStatusSchema.extend({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .update(tasks)
        .set({ status: input.status, updatedAt: new Date() })
        .where(and(eq(tasks.id, input.taskId), eq(tasks.workspaceId, ctx.workspaceId)))
        .returning();

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return task;
    }),
});
