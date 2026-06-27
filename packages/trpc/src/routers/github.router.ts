import { desc, eq } from "drizzle-orm";
import { repositories, pullRequests } from "@alfred/db";
import { createTRPCRouter, workspaceProcedure } from "../trpc";

export const githubRouter = createTRPCRouter({
  listRepositories: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(repositories)
      .where(eq(repositories.workspaceId, ctx.workspaceId));
  }),

  getRecentPRs: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: pullRequests.id,
        githubPrNumber: pullRequests.githubPrNumber,
        title: pullRequests.title,
        status: pullRequests.status,
        featureId: pullRequests.featureId,
        repositoryId: pullRequests.repositoryId,
      })
      .from(pullRequests)
      .innerJoin(repositories, eq(repositories.id, pullRequests.repositoryId))
      .where(eq(repositories.workspaceId, ctx.workspaceId))
      .orderBy(desc(pullRequests.createdAt))
      .limit(5);
  }),
});
