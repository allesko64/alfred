import { TRPCError } from "@trpc/server";
import { createProjectSchema } from "@alfred/validators";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { projects } from "@alfred/db";
import { createTRPCRouter, workspaceProcedure } from "../trpc";

export const projectRouter = createTRPCRouter({
  create: workspaceProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const [project] = await ctx.db
        .insert(projects)
        .values({
          workspaceId: ctx.workspaceId,
          name: input.name,
          description: input.description,
          createdBy: ctx.user.id,
        })
        .returning();

      return project;
    }),

  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(projects).where(eq(projects.workspaceId, ctx.workspaceId));
  }),

  getById: workspaceProcedure
    .input(z.object({ workspaceId: z.string().uuid(), projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [project] = await ctx.db
        .select()
        .from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return project;
    }),
});
