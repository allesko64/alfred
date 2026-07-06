import { serve } from "inngest/next";
import {
  aiReviewWorkflow,
  changelogGenerationWorkflow,
  clarificationWorkflow,
  dailyDigestWorkflow,
  featureShippedEmailWorkflow,
  inngest,
  monthlyCreditResetWorkflow,
  prdGenerationWorkflow,
  prIngestionWorkflow,
  reReviewWorkflow,
  releaseReadinessWorkflow,
  repoVectorizationWorkflow,
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
    releaseReadinessWorkflow,
    changelogGenerationWorkflow,
    dailyDigestWorkflow,
    featureShippedEmailWorkflow,
    repoVectorizationWorkflow,
    monthlyCreditResetWorkflow,
  ],
});
