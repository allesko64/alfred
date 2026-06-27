import { TRPCError } from "@trpc/server";
import { createWorkspaceSchema } from "@alfred/validators";
import { eq } from "drizzle-orm";
import { workspaceMemberships, workspaces } from "@alfred/db";
import { createTRPCRouter, protectedProcedure, workspaceProcedure } from "../trpc";

export const workspaceRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createWorkspaceSchema)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.slug, input.slug))
        .limit(1);

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "That slug is already taken" });
      }

      const [workspace] = await ctx.db
        .insert(workspaces)
        .values({
          name: input.name,
          slug: input.slug,
          ownerId: ctx.user.id,
        })
        .returning();

      if (!workspace) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      await ctx.db.insert(workspaceMemberships).values({
        userId: ctx.user.id,
        workspaceId: workspace.id,
        role: "owner",
        status: "active",
      });

      return workspace;
    }),

  getById: workspaceProcedure.query(async ({ ctx }) => {
    const [workspace] = await ctx.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, ctx.workspaceId))
      .limit(1);

    if (!workspace) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    return { ...workspace, role: ctx.role };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        plan: workspaces.plan,
        role: workspaceMemberships.role,
      })
      .from(workspaceMemberships)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
      .where(eq(workspaceMemberships.userId, ctx.user.id));
  }),
});
