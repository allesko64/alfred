import { serve } from "inngest/next";
import { clarificationWorkflow, inngest, prdGenerationWorkflow } from "@alfred/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [clarificationWorkflow, prdGenerationWorkflow],
});
