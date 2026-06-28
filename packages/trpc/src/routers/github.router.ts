import { TRPCError } from "@trpc/server";
import {
  completeWorkspaceOnboardingSchema,
  getInstallationUrlSchema,
  listInstallationReposSchema,
  lookupGithubUserSchema,
} from "@alfred/validators";
import { desc, eq } from "drizzle-orm";
import {
  features,
  projects,
  pullRequests,
  repositories,
  workspaceMemberships,
  workspaces,
} from "@alfred/db";
import {
  getInstallationUrl,
  listInstallationRepositories,
  lookupGithubUser,
} from "@alfred/ai";
import { inngest } from "@alfred/inngest";
import {
  createTRPCRouter,
  protectedProcedure,
  workspaceInputSchema,
  workspaceProcedure,
} from "../trpc";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base.length > 0 ? base : "workspace";
}

export const githubRouter = createTRPCRouter({
  listRepositories: workspaceProcedure.input(workspaceInputSchema).query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(repositories)
      .where(eq(repositories.workspaceId, ctx.workspaceId));
  }),

  getRecentPRs: workspaceProcedure.input(workspaceInputSchema).query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: pullRequests.id,
        githubPrNumber: pullRequests.githubPrNumber,
        title: pullRequests.title,
        status: pullRequests.status,
        featureId: pullRequests.featureId,
        featureTitle: features.title,
        repositoryId: pullRequests.repositoryId,
        repositoryName: repositories.fullName,
      })
      .from(pullRequests)
      .innerJoin(repositories, eq(repositories.id, pullRequests.repositoryId))
      .leftJoin(features, eq(features.id, pullRequests.featureId))
      .where(eq(repositories.workspaceId, ctx.workspaceId))
      .orderBy(desc(pullRequests.createdAt))
      .limit(5);
  }),

  /** Lists repos the GitHub App installation has access to. */
  listInstallationRepos: protectedProcedure
    .input(listInstallationReposSchema)
    .query(async ({ input }) => {
      return listInstallationRepositories(input.installationId);
    }),

  /** Builds the GitHub App installation URL for the "Connect GitHub" button. */
  getInstallationUrl: protectedProcedure
    .input(getInstallationUrlSchema)
    .query(async ({ input }) => {
      return { url: await getInstallationUrl(input.state) };
    }),

  /** Looks up a GitHub user's public profile for the team-invite picker. */
  lookupUser: protectedProcedure.input(lookupGithubUserSchema).query(async ({ input }) => {
    return lookupGithubUser(input.username);
  }),

  /**
   * Finalizes onboarding page 1: creates the workspace, owner membership, a
   * default project, and connects a repo from the GitHub App installation.
   * Runs after the GitHub App install/OAuth round-trip returns. If no
   * `githubRepoId` is given, the first repo accessible to the installation
   * is used.
   */
  completeWorkspaceOnboarding: protectedProcedure
    .input(completeWorkspaceOnboardingSchema)
    .mutation(async ({ ctx, input }) => {
      const installedRepos = await listInstallationRepositories(input.installationId);
      const selectedRepo = input.githubRepoId
        ? installedRepos.find((repo) => repo.githubRepoId === input.githubRepoId)
        : installedRepos[0];

      if (!selectedRepo) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No repository is accessible to this GitHub App installation",
        });
      }

      const baseSlug = slugify(input.name);
      let slug = baseSlug;
      let suffix = 1;
      while (true) {
        const [existing] = await ctx.db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.slug, slug))
          .limit(1);

        if (!existing) break;
        suffix += 1;
        slug = `${baseSlug}-${suffix}`;
      }

      const { workspace, repository } = await ctx.db.transaction(async (tx) => {
        const [workspace] = await tx
          .insert(workspaces)
          .values({
            name: input.name,
            slug,
            ownerId: ctx.user.id,
            buildingType: input.buildingType,
            onboardingStep: "team",
          })
          .returning();

        if (!workspace) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        await tx.insert(workspaceMemberships).values({
          userId: ctx.user.id,
          workspaceId: workspace.id,
          role: "owner",
          status: "active",
        });

        const [project] = await tx
          .insert(projects)
          .values({
            workspaceId: workspace.id,
            name: "General",
            createdBy: ctx.user.id,
          })
          .returning();

        if (!project) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        const [repository] = await tx
          .insert(repositories)
          .values({
            projectId: project.id,
            workspaceId: workspace.id,
            githubRepoId: selectedRepo.githubRepoId,
            fullName: selectedRepo.fullName,
            owner: selectedRepo.owner,
            name: selectedRepo.name,
            defaultBranch: selectedRepo.defaultBranch,
            installationId: input.installationId,
          })
          .returning();

        if (!repository) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        return { workspace, repository };
      });

      // Best-effort: the workspace/repo are already committed above, so a
      // failure to kick off vectorization (e.g. Inngest not configured yet)
      // shouldn't fail onboarding.
      try {
        await inngest.send({
          name: "repo/vectorization.requested",
          data: {
            repositoryId: repository.id,
            installationId: input.installationId,
          },
        });
      } catch (error) {
        console.error("Failed to fire repo/vectorization.requested", error);
      }

      return { workspaceId: workspace.id, repositoryId: repository.id };
    }),
});
