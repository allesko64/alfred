import type { InngestFunction } from "inngest";
import { inngest } from "../client";
import { reportWorkflowProgress } from "../workflow-runs";
import { performReview, type StepRun } from "./review-core";

/**
 * Runs an AI review immediately — used for the first review after a PR is
 * linked, and for manual "Review now" / "Request Re-review" clicks. Not
 * debounced; see `re-review.workflow.ts` for the webhook-driven, debounced
 * path.
 */
const _aiReviewWorkflow = inngest.createFunction(
  {
    id: "feature-ai-review",
    triggers: { event: "feature/ai-review.requested" },
  },
  async ({ event, step, runId }) => {
    const run: StepRun = (id, fn) => step.run(id, fn) as ReturnType<typeof fn>;
    try {
      return await performReview(run, {
        featureId: event.data.featureId,
        pullRequestId: event.data.pullRequestId,
        workflowType: "ai_review",
        inngestRunId: runId,
      });
    } catch (error) {
      await reportWorkflowProgress(event.data.featureId, "ai_review", {
        status: "failed",
        progressMessage: "Review failed unexpectedly",
        errorMessage: error instanceof Error ? error.message : String(error),
        progressPercent: 100,
      });
      throw error;
    }
  },
);

export const aiReviewWorkflow: InngestFunction.Any = _aiReviewWorkflow;
