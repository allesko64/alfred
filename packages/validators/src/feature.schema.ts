import { z } from "zod";

export const createFeatureSchema = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  content: z.string().min(10, "Tell Alfred a bit more about the feature"),
});

export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;

export const submitClarificationReplySchema = z.object({
  featureId: z.string().uuid(),
  content: z.string().min(1, "Reply cannot be empty"),
});

export type SubmitClarificationReplyInput = z.infer<typeof submitClarificationReplySchema>;

export const approveFeatureSchema = z.object({
  featureId: z.string().uuid(),
});

export type ApproveFeatureInput = z.infer<typeof approveFeatureSchema>;

export const rejectFeatureSchema = z.object({
  featureId: z.string().uuid(),
  reason: z.string().min(1, "A reason is required"),
});

export type RejectFeatureInput = z.infer<typeof rejectFeatureSchema>;
