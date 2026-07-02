import { z } from "zod";

export const createPRDSchema = z.object({
  featureId: z.string().uuid(),
  problemStatement: z.string().min(1),
  goals: z.array(z.string()).default([]),
  nonGoals: z.array(z.string()).default([]),
  userStories: z.array(z.string()).default([]),
  acceptanceCriteria: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  scopeWarning: z.string().nullable().optional(),
  rawContent: z.string().optional(),
  generatedBy: z.string().optional(),
});

export type CreatePRDInput = z.infer<typeof createPRDSchema>;

export const approvePRDSchema = z.object({
  featureId: z.string().uuid(),
});

export type ApprovePRDInput = z.infer<typeof approvePRDSchema>;

export const updatePRDSchema = z.object({
  featureId: z.string().uuid(),
  problemStatement: z.string().min(1),
  goals: z.array(z.string()).default([]),
  nonGoals: z.array(z.string()).default([]),
  userStories: z.array(z.string()).default([]),
  acceptanceCriteria: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
});

export type UpdatePRDInput = z.infer<typeof updatePRDSchema>;
