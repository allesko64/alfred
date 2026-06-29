import { getPullRequestWithDiff } from "@alfred/ai";
import { db, features, notifications, pullRequests, repositories, workspaces } from "@alfred/db";
import { and, eq, ne } from "drizzle-orm";
import type { InngestFunction } from "inngest";
import { inngest } from "../client";
import { reportWorkflowProgress } from "../workflow-runs";

const RE_REVIEW_DEBOUNCE_MS = 5 * 60 * 1000;

const BRANCH_PATTERN = /^alfred\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const _prIngestionWorkflow = inngest.createFunction(
  { id: "github-pr-ingestion", triggers: { event: "github/pr-ingestion.requested" } },
  async ({ event, step }) => {
    const { githubRepoId, githubPrNumber, action } = event.data;

    const repository = await step.run("find-repository", async () => {
      const [repo] = await db
        .select()
        .from(repositories)
        .where(eq(repositories.githubRepoId, githubRepoId))
        .limit(1);

      if (!repo) {
        console.log(`pr-ingestion: no repository found for githubRepoId=${githubRepoId}, skipping`);
        return null;
      }

      return repo;
    });

    if (!repository) {
      return { status: "skipped", reason: "unrecognized-repo" };
    }

    const prDetails = await step.run("fetch-pr-and-diff", async () => {
      return getPullRequestWithDiff(
        repository.installationId,
        repository.owner ?? repository.fullName.split("/")[0]!,
        repository.name ?? repository.fullName.split("/")[1]!,
        githubPrNumber,
      );
    });

    const status = prDetails.isMerged ? "MERGED" : prDetails.isOpen ? "OPEN" : "CLOSED";

    const pr = await step.run("upsert-pull-request", async () => {
      const [saved] = await db
        .insert(pullRequests)
        .values({
          repositoryId: repository.id,
          githubPrId: prDetails.githubPrId,
          githubPrNumber: prDetails.number,
          title: prDetails.title,
          body: prDetails.body,
          author: prDetails.author,
          headBranch: prDetails.headBranch,
          baseBranch: prDetails.baseBranch,
          diff: prDetails.diff,
          diffUrl: prDetails.htmlUrl,
          status,
          mergedAt: prDetails.isMerged ? new Date() : null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: pullRequests.githubPrId,
          set: {
            title: prDetails.title,
            body: prDetails.body,
            headBranch: prDetails.headBranch,
            baseBranch: prDetails.baseBranch,
            diff: prDetails.diff,
            diffUrl: prDetails.htmlUrl,
            status,
            mergedAt: prDetails.isMerged ? new Date() : null,
            updatedAt: new Date(),
          },
        })
        .returning();

      await db
        .update(repositories)
        .set({ lastWebhookAt: new Date() })
        .where(eq(repositories.id, repository.id));

      return saved!;
    });

    if (action === "synchronize" && pr.featureId) {
      // Decision 8: re-review path for an already-linked PR. The debounce
      // banner state is written here (immediately), separate from the
      // actual debounced re-review run which fires 5 minutes later.
      await step.run("schedule-re-review-debounce", async () => {
        await reportWorkflowProgress(pr.featureId!, "re_review", {
          status: "pending",
          progressMessage: "New commits detected. Alfred will start reviewing in 5 minutes.",
          scheduledAt: new Date(Date.now() + RE_REVIEW_DEBOUNCE_MS),
        });
      });

      await step.sendEvent("fire-pr-resync", {
        name: "feature/pr-resync.requested",
        data: { featureId: pr.featureId, pullRequestId: pr.id },
      });

      return { status: "ingested", linked: true, resync: true };
    }

    if (action === "closed" || pr.featureId) {
      // Already linked (or now just closed/merged) — nothing further to auto-link.
      return { status: "ingested", linked: !!pr.featureId };
    }

    const linkedFeature = await step.run("attempt-auto-link", async () => {
      const match = BRANCH_PATTERN.exec(prDetails.headBranch);
      if (!match) return null;

      const candidateFeatureId = match[1]!;
      const [feature] = await db
        .select()
        .from(features)
        .where(and(eq(features.id, candidateFeatureId), eq(features.workspaceId, repository.workspaceId)))
        .limit(1);

      if (!feature) return null;

      const [existingLink] = await db
        .select({ id: pullRequests.id })
        .from(pullRequests)
        .where(and(eq(pullRequests.featureId, feature.id), ne(pullRequests.id, pr.id)))
        .limit(1);

      if (existingLink) {
        // One PR per feature — an existing link wins, skip silently.
        return null;
      }

      await db
        .update(pullRequests)
        .set({ featureId: feature.id, updatedAt: new Date() })
        .where(eq(pullRequests.id, pr.id));

      await db
        .update(features)
        .set({ status: "PR_LINKED", updatedAt: new Date() })
        .where(eq(features.id, feature.id));

      return feature;
    });

    await step.run("notify", async () => {
      if (linkedFeature) {
        await db.insert(notifications).values({
          userId: linkedFeature.createdBy,
          workspaceId: linkedFeature.workspaceId,
          type: "pr_linked",
          title: "PR linked, review starting",
          message: `PR #${prDetails.number} (${prDetails.title}) was linked to "${linkedFeature.title}".`,
          featureId: linkedFeature.id,
        });
      } else {
        const [workspace] = await db
          .select({ ownerId: workspaces.ownerId })
          .from(workspaces)
          .where(eq(workspaces.id, repository.workspaceId))
          .limit(1);

        if (workspace) {
          await db.insert(notifications).values({
            userId: workspace.ownerId,
            workspaceId: repository.workspaceId,
            type: "pr_unlinked",
            title: "New PR needs linking",
            message: `New PR #${prDetails.number} needs to be linked to a feature.`,
          });
        }
      }
    });

    if (linkedFeature) {
      await step.sendEvent("fire-ai-review", {
        name: "feature/ai-review.requested",
        data: { featureId: linkedFeature.id, pullRequestId: pr.id },
      });
    }

    return { status: "ingested", linked: !!linkedFeature };
  },
);

export const prIngestionWorkflow: InngestFunction.Any = _prIngestionWorkflow;
