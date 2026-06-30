import { chatCompleteJSON } from "@alfred/ai";
import {
  aiReviews,
  db,
  features,
  notifications,
  prds,
  pullRequests,
  reviewIssues,
  tasks,
  users,
  workspaceMemberships,
} from "@alfred/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { InngestFunction } from "inngest";
import { inngest } from "../client";
import { reportWorkflowProgress } from "../workflow-runs";

const APPROVER_ROLES = ["owner", "admin", "reviewer"] as const;

/** Spec 10.1: configurable — default allows shipping with an open (unmerged) PR. */
const REQUIRE_PR_MERGED =
  process.env.RELEASE_READINESS_REQUIRE_MERGED === "true";

const RELEASE_SUMMARY_PROMPT = `You are Alfred, an AI software delivery co-pilot. A feature has passed
every automated gate and is about to be handed to a human approver.
Write a short release summary for that approver.

Feature title:
{{FEATURE_TITLE}}

PRD problem statement:
{{PROBLEM_STATEMENT}}

Tasks completed:
{{TASKS}}

Latest AI review summary:
{{REVIEW_SUMMARY}}

Write 2-4 sentences covering what shipped and any residual risk the
approver should know about. Be direct and honest.

Respond with ONLY a valid JSON object, no markdown, no commentary:

{
  "summary": "string"
}`;

interface ReleaseSummaryOut {
  summary: string;
}

const _releaseReadinessWorkflow = inngest.createFunction(
  {
    id: "feature-release-readiness",
    triggers: { event: "feature/release-readiness.requested" },
  },
  async ({ event, step }) => {
    const { featureId } = event.data;

    const context = await step.run("fetch-context", async () => {
      const [feature] = await db
        .select()
        .from(features)
        .where(eq(features.id, featureId))
        .limit(1);
      if (!feature) return null;

      const [pr] = await db
        .select()
        .from(pullRequests)
        .where(eq(pullRequests.featureId, featureId))
        .limit(1);
      const [prd] = await db
        .select()
        .from(prds)
        .where(eq(prds.featureId, featureId))
        .limit(1);
      const taskRows = await db
        .select()
        .from(tasks)
        .where(eq(tasks.featureId, featureId));

      const [latestReview] = await db
        .select()
        .from(aiReviews)
        .where(
          and(
            eq(aiReviews.featureId, featureId),
            eq(aiReviews.isArchived, false),
          ),
        )
        .orderBy(desc(aiReviews.reviewNumber))
        .limit(1);

      const unresolvedBlocking = latestReview
        ? await db
            .select({ id: reviewIssues.id })
            .from(reviewIssues)
            .where(
              and(
                eq(reviewIssues.reviewId, latestReview.id),
                eq(reviewIssues.severity, "BLOCKING"),
                eq(reviewIssues.isResolved, false),
              ),
            )
        : [];

      return { feature, pr, prd, taskRows, latestReview, unresolvedBlocking };
    });

    if (!context) {
      return { status: "skipped", reason: "feature-not-found" };
    }

    const { feature, pr, prd, taskRows, latestReview, unresolvedBlocking } =
      context;

    await step.run("report-progress-running", async () => {
      await reportWorkflowProgress(featureId, "release_readiness", {
        status: "running",
        progressMessage: "Alfred is checking release readiness...",
        progressPercent: 20,
      });
    });

    const reasons: string[] = [];
    if (!latestReview || latestReview.status !== "PASSED") {
      reasons.push("AI review has not passed yet");
    }
    if (
      (latestReview?.blockingCount ?? 1) > 0 ||
      unresolvedBlocking.length > 0
    ) {
      reasons.push("There are unresolved blocking issues");
    }
    const incompleteTasks = taskRows.filter((t) => t.status !== "DONE");
    if (incompleteTasks.length > 0) {
      reasons.push(`${incompleteTasks.length} task(s) are not marked DONE`);
    }
    if (!pr) {
      reasons.push("No pull request is linked");
    } else if (
      REQUIRE_PR_MERGED ? pr.status !== "MERGED" : pr.status === "CLOSED"
    ) {
      reasons.push(
        REQUIRE_PR_MERGED
          ? "The pull request is not merged"
          : "The pull request was closed unmerged",
      );
    }

    if (reasons.length > 0) {
      await step.run("report-not-ready", async () => {
        await reportWorkflowProgress(featureId, "release_readiness", {
          status: "completed",
          progressMessage: `Not ready yet: ${reasons.join("; ")}`,
          progressPercent: 100,
        });
      });
      return { status: "not_ready", reasons };
    }

    const summary = await step.run("generate-release-summary", async () => {
      const prompt = RELEASE_SUMMARY_PROMPT.replace(
        "{{FEATURE_TITLE}}",
        feature.title,
      )
        .replace(
          "{{PROBLEM_STATEMENT}}",
          prd?.problemStatement ?? "Not specified",
        )
        .replace(
          "{{TASKS}}",
          taskRows.map((t) => `- ${t.title}`).join("\n") || "No tasks recorded",
        )
        .replace(
          "{{REVIEW_SUMMARY}}",
          latestReview?.summary ?? "No summary available",
        );

      const { data: result } = await chatCompleteJSON<ReleaseSummaryOut>([
        { role: "system", content: prompt },
      ]);
      return result.summary;
    });

    await step.run("finalize-and-notify-approvers", async () => {
      await db
        .update(features)
        .set({ status: "PENDING_APPROVAL", updatedAt: new Date() })
        .where(eq(features.id, featureId));

      const approvers = await db
        .select({ userId: workspaceMemberships.userId })
        .from(workspaceMemberships)
        .innerJoin(users, eq(users.id, workspaceMemberships.userId))
        .where(
          and(
            eq(workspaceMemberships.workspaceId, feature.workspaceId),
            eq(workspaceMemberships.status, "active"),
            inArray(workspaceMemberships.role, APPROVER_ROLES),
          ),
        );

      if (approvers.length > 0) {
        await db.insert(notifications).values(
          approvers.map((approver) => ({
            userId: approver.userId,
            workspaceId: feature.workspaceId,
            type: "approval_requested",
            title: "Feature ready for approval",
            message: `${feature.title} passed every automated gate and is waiting on your approval.`,
            featureId,
          })),
        );
      }

      await reportWorkflowProgress(featureId, "release_readiness", {
        status: "completed",
        progressMessage: summary,
        progressPercent: 100,
      });
    });

    return { status: "pending_approval" };
  },
);

export const releaseReadinessWorkflow: InngestFunction.Any =
  _releaseReadinessWorkflow;
