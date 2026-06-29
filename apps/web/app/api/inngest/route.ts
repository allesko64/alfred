import { serve } from "inngest/next";
import {
  aiReviewWorkflow,
  clarificationWorkflow,
  inngest,
  prdGenerationWorkflow,
  prIngestionWorkflow,
  reReviewWorkflow,
  taskGenerationWorkflow,
} from "@alfred/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    clarificationWorkflow,
    prdGenerationWorkflow,
    taskGenerationWorkflow,
    prIngestionWorkflow,
    aiReviewWorkflow,
    reReviewWorkflow,
  ],
});
