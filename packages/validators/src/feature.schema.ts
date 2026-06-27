import { z } from "zod";

export const createFeatureSchema = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Describe the request in at least 10 characters"),
});

export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;

export const submitClarificationReplySchema = z.object({
  featureId: z.string().uuid(),
  content: z.string().min(1, "Reply cannot be empty"),
});

export type SubmitClarificationReplyInput = z.infer<typeof submitClarificationReplySchema>;
