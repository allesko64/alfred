import { TRPCError } from "@trpc/server";
import {
  approveTaskPlanSchema,
  createTaskSchema,
  moveTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from "@alfred/validators";
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

  // Used by the Kanban board's drag-and-drop: updates both the column (status)
  // and the position within that column in one call.
  move: workspaceProcedure
    .input(moveTaskSchema.extend({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .update(tasks)
        .set({ status: input.status, position: input.position, updatedAt: new Date() })
        .where(and(eq(tasks.id, input.taskId), eq(tasks.workspaceId, ctx.workspaceId)))
        .returning();

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return task;
    }),

  update: workspaceProcedure
    .input(updateTaskSchema.extend({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { taskId, workspaceId, ...patch } = input;

      const [task] = await ctx.db
        .update(tasks)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, ctx.workspaceId)))
        .returning();

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return task;
    }),

  approvePlan: workspaceProcedure
    .input(approveTaskPlanSchema.extend({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .update(features)
        .set({ status: "IN_DEVELOPMENT", updatedAt: new Date() })
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .returning();

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return feature;
    }),
});
