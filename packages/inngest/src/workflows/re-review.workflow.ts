import type { InngestFunction } from "inngest";
import { inngest } from "../client";
import { performReview, type StepRun } from "./review-core";

/**
 * Decision 1: re-review debounce. Each `synchronize` webhook on an
 * already-linked PR fires `feature/pr-resync.requested`. Inngest's built-in
 * debounce collapses repeated events within the window into a single run,
 * keyed per feature so two features never share a debounce window.
 */
const _reReviewWorkflow = inngest.createFunction(
  {
    id: "feature-re-review",
    triggers: { event: "feature/pr-resync.requested" },
    debounce: { key: "event.data.featureId", period: "5m" },
  },
  async ({ event, step }) => {
    const run: StepRun = (id, fn) => step.run(id, fn) as ReturnType<typeof fn>;
    return performReview(run, {
      featureId: event.data.featureId,
      pullRequestId: event.data.pullRequestId,
      workflowType: "re_review",
    });
  },
);

export const reReviewWorkflow: InngestFunction.Any = _reReviewWorkflow;
