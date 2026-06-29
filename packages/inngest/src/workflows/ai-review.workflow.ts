import type { InngestFunction } from "inngest";
import { inngest } from "../client";
import { performReview, type StepRun } from "./review-core";

/**
 * Runs an AI review immediately — used for the first review after a PR is
 * linked, and for manual "Review now" / "Request Re-review" clicks. Not
 * debounced; see `re-review.workflow.ts` for the webhook-driven, debounced
 * path.
 */
const _aiReviewWorkflow = inngest.createFunction(
  { id: "feature-ai-review", triggers: { event: "feature/ai-review.requested" } },
  async ({ event, step }) => {
    const run: StepRun = (id, fn) => step.run(id, fn) as ReturnType<typeof fn>;
    return performReview(run, {
      featureId: event.data.featureId,
      pullRequestId: event.data.pullRequestId,
      workflowType: "ai_review",
    });
  },
);

export const aiReviewWorkflow: InngestFunction.Any = _aiReviewWorkflow;
