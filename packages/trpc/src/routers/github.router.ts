import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  completeWorkspaceOnboardingSchema,
  connectRepositorySchema,
  getInstallationUrlSchema,
  linkPullRequestSchema,
  listInstallationReposSchema,
  listUnlinkedPullRequestsSchema,
  lookupGithubUserSchema,
  repositoryActionSchema,
  requestReviewNowSchema,
  unlinkPullRequestSchema,
} from "@alfred/validators";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  aiReviews,
  codeChunks,
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
import { inngest, reportWorkflowProgress } from "@alfred/inngest";
import {
  createTRPCRouter,
  protectedProcedure,
  workspaceInputSchema,
  workspaceProcedure,
} from "../trpc";

const FREE_PLAN_REPO_LIMIT = 1;

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
        htmlUrl: pullRequests.diffUrl,
      })
      .from(pullRequests)
      .innerJoin(repositories, eq(repositories.id, pullRequests.repositoryId))
      .leftJoin(features, eq(features.id, pullRequests.featureId))
      .where(eq(repositories.workspaceId, ctx.workspaceId))
      .orderBy(desc(pullRequests.createdAt))
      .limit(10);
  }),

  listUnlinkedPullRequests: workspaceProcedure
    .input(listUnlinkedPullRequestsSchema)
    .query(async ({ ctx }) => {
      return ctx.db
        .select({
          id: pullRequests.id,
          githubPrNumber: pullRequests.githubPrNumber,
          title: pullRequests.title,
          status: pullRequests.status,
          repositoryName: repositories.fullName,
        })
        .from(pullRequests)
        .innerJoin(repositories, eq(repositories.id, pullRequests.repositoryId))
        .where(
          and(
            eq(repositories.workspaceId, ctx.workspaceId),
            isNull(pullRequests.featureId),
            eq(pullRequests.status, "OPEN"),
          ),
        )
        .orderBy(desc(pullRequests.createdAt));
    }),

  /** Returns the single PR linked to a feature, if any (one-PR-per-feature). */
  getLinkedPullRequest: workspaceProcedure
    .input(z.object({ workspaceId: z.string().uuid(), featureId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [pr] = await ctx.db
        .select({
          id: pullRequests.id,
          githubPrNumber: pullRequests.githubPrNumber,
          title: pullRequests.title,
          status: pullRequests.status,
          htmlUrl: pullRequests.diffUrl,
          repositoryName: repositories.fullName,
        })
        .from(pullRequests)
        .innerJoin(repositories, eq(repositories.id, pullRequests.repositoryId))
        .where(and(eq(pullRequests.featureId, input.featureId), eq(repositories.workspaceId, ctx.workspaceId)))
        .limit(1);

      return pr ?? null;
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

  /**
   * Connects an additional repository to an existing workspace (post-onboarding).
   * Free plan is limited to one repo total, enforced here.
   */
  connectRepository: workspaceProcedure
    .input(connectRepositorySchema)
    .mutation(async ({ ctx, input }) => {
      const [workspace] = await ctx.db
        .select({ plan: workspaces.plan })
        .from(workspaces)
        .where(eq(workspaces.id, ctx.workspaceId))
        .limit(1);

      if (workspace?.plan === "free") {
        const existingRepos = await ctx.db
          .select({ id: repositories.id })
          .from(repositories)
          .where(and(eq(repositories.workspaceId, ctx.workspaceId), isNull(repositories.disconnectedAt)));

        if (existingRepos.length >= FREE_PLAN_REPO_LIMIT) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Free plan is limited to 1 connected repository. Upgrade to connect more.",
          });
        }
      }

      const installedRepos = await listInstallationRepositories(input.installationId);
      const selectedRepo = installedRepos.find((repo) => repo.githubRepoId === input.githubRepoId);

      if (!selectedRepo) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Repository is not accessible to this GitHub App installation",
        });
      }

      const [project] = await ctx.db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.workspaceId, ctx.workspaceId))
        .limit(1);

      if (!project) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Workspace has no project" });
      }

      const [repository] = await ctx.db
        .insert(repositories)
        .values({
          projectId: project.id,
          workspaceId: ctx.workspaceId,
          githubRepoId: selectedRepo.githubRepoId,
          fullName: selectedRepo.fullName,
          owner: selectedRepo.owner,
          name: selectedRepo.name,
          defaultBranch: selectedRepo.defaultBranch,
          installationId: input.installationId,
        })
        .onConflictDoUpdate({
          target: repositories.githubRepoId,
          set: { disconnectedAt: null, workspaceId: ctx.workspaceId, installationId: input.installationId },
        })
        .returning();

      if (!repository) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      try {
        await inngest.send({
          name: "repo/vectorization.requested",
          data: { repositoryId: repository.id, installationId: input.installationId },
        });
      } catch (error) {
        console.error("Failed to fire repo/vectorization.requested", error);
      }

      return repository;
    }),

  /** Disconnects a repo: marks it inactive and removes its PRs and indexed code chunks. */
  disconnectRepository: workspaceProcedure
    .input(repositoryActionSchema)
    .mutation(async ({ ctx, input }) => {
      const [repository] = await ctx.db
        .select({ id: repositories.id })
        .from(repositories)
        .where(and(eq(repositories.id, input.repositoryId), eq(repositories.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!repository) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.db.delete(pullRequests).where(eq(pullRequests.repositoryId, repository.id));
      await ctx.db.delete(codeChunks).where(eq(codeChunks.repositoryId, repository.id));

      await ctx.db
        .update(repositories)
        .set({ disconnectedAt: new Date(), isIndexed: false, indexedAt: null })
        .where(eq(repositories.id, repository.id));

      return { ok: true };
    }),

  /** Reconnects a previously disconnected repo and re-triggers vectorization. */
  reconnectRepository: workspaceProcedure
    .input(repositoryActionSchema)
    .mutation(async ({ ctx, input }) => {
      const [repository] = await ctx.db
        .select()
        .from(repositories)
        .where(and(eq(repositories.id, input.repositoryId), eq(repositories.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!repository) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.db
        .update(repositories)
        .set({ disconnectedAt: null })
        .where(eq(repositories.id, repository.id));

      try {
        await inngest.send({
          name: "repo/vectorization.requested",
          data: { repositoryId: repository.id, installationId: repository.installationId },
        });
      } catch (error) {
        console.error("Failed to fire repo/vectorization.requested", error);
      }

      return { ok: true };
    }),

  /** Manually links an unlinked, open PR to a feature. One PR per feature, enforced here. */
  linkPullRequest: workspaceProcedure
    .input(linkPullRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });
      }

      const [existingLink] = await ctx.db
        .select({ id: pullRequests.id })
        .from(pullRequests)
        .where(eq(pullRequests.featureId, feature.id))
        .limit(1);

      if (existingLink) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This feature already has a linked PR. Unlink it first.",
        });
      }

      const [pr] = await ctx.db
        .update(pullRequests)
        .set({ featureId: feature.id, updatedAt: new Date() })
        .where(eq(pullRequests.id, input.pullRequestId))
        .returning();

      if (!pr) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pull request not found" });
      }

      await ctx.db
        .update(features)
        .set({ status: "PR_LINKED", updatedAt: new Date() })
        .where(eq(features.id, feature.id));

      try {
        await inngest.send({
          name: "feature/ai-review.requested",
          data: { featureId: feature.id, pullRequestId: pr.id },
        });
      } catch (error) {
        console.error("Failed to fire feature/ai-review.requested", error);
      }

      return { ok: true };
    }),

  /** Unlinks a PR from its feature. Fully reversible, no confirmation needed. */
  unlinkPullRequest: workspaceProcedure
    .input(unlinkPullRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const [pr] = await ctx.db
        .select({ id: pullRequests.id, featureId: pullRequests.featureId, repositoryId: pullRequests.repositoryId })
        .from(pullRequests)
        .innerJoin(repositories, eq(repositories.id, pullRequests.repositoryId))
        .where(and(eq(pullRequests.id, input.pullRequestId), eq(repositories.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!pr) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.db
        .update(pullRequests)
        .set({ featureId: null, updatedAt: new Date() })
        .where(eq(pullRequests.id, pr.id));

      if (pr.featureId) {
        await ctx.db
          .update(features)
          .set({ status: "IN_DEVELOPMENT", updatedAt: new Date() })
          .where(eq(features.id, pr.featureId));

        // Decision 8: reviews stay in the DB but are marked archived. A
        // future re-link starts review numbering fresh from #1, since
        // reviewNumber is always computed over non-archived rows only.
        await ctx.db
          .update(aiReviews)
          .set({ isArchived: true })
          .where(eq(aiReviews.featureId, pr.featureId));
      }

      return { ok: true };
    }),

  /** Decision 1: cancels the re-review debounce banner and runs the review immediately. */
  requestReviewNow: workspaceProcedure
    .input(requestReviewNowSchema)
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [pr] = await ctx.db
        .select({ id: pullRequests.id })
        .from(pullRequests)
        .where(eq(pullRequests.featureId, feature.id))
        .limit(1);

      if (!pr) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No PR linked to this feature" });
      }

      // Clears the debounce banner immediately — the actual review may run
      // under either workflow type, but the banner is keyed off `re_review`.
      await reportWorkflowProgress(feature.id, "re_review", {
        status: "running",
        progressMessage: "Alfred is reviewing your PR...",
        progressPercent: 20,
        scheduledAt: null,
      });

      await inngest.send({
        name: "feature/ai-review.requested",
        data: { featureId: feature.id, pullRequestId: pr.id },
      });

      return { ok: true };
    }),
});
