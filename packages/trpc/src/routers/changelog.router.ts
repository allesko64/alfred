import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { workspaceSlugInputSchema } from "@alfred/validators";
import { changelog, features, workspaces } from "@alfred/db";
import { createTRPCRouter, publicProcedure, workspaceInputSchema, workspaceProcedure } from "../trpc";

export const changelogRouter = createTRPCRouter({
  /** Authenticated, in-app changelog tab — newest first. */
  getByWorkspace: workspaceProcedure.input(workspaceInputSchema).query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: changelog.id,
        version: changelog.version,
        entry: changelog.entry,
        type: changelog.type,
        createdAt: changelog.createdAt,
        featureId: changelog.featureId,
        featureTitle: features.title,
      })
      .from(changelog)
      .innerJoin(features, eq(features.id, changelog.featureId))
      .where(eq(changelog.workspaceId, ctx.workspaceId))
      .orderBy(desc(changelog.createdAt));
  }),

  /** Public, unauthenticated changelog at /changelog/[workspaceSlug] — spec 10.4. */
  getPublicByWorkspaceSlug: publicProcedure
    .input(workspaceSlugInputSchema)
    .query(async ({ ctx, input }) => {
      const [workspace] = await ctx.db
        .select({ id: workspaces.id, name: workspaces.name })
        .from(workspaces)
        .where(eq(workspaces.slug, input.workspaceSlug))
        .limit(1);

      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const entries = await ctx.db
        .select({
          id: changelog.id,
          version: changelog.version,
          entry: changelog.entry,
          type: changelog.type,
          createdAt: changelog.createdAt,
          featureTitle: features.title,
        })
        .from(changelog)
        .innerJoin(features, eq(features.id, changelog.featureId))
        .where(eq(changelog.workspaceId, workspace.id))
        .orderBy(desc(changelog.createdAt));

      return { workspaceName: workspace.name, entries };
    }),
});
