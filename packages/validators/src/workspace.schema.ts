import { workspacePlanEnum } from "@alfred/db/enums";
import { z } from "zod";

/** Paid-tier subset of `workspacePlanEnum` — the plans purchasable via checkout ("free" isn't). */
export const paidPlanValues = workspacePlanEnum.enumValues.filter(
  (plan) => plan !== "free",
) as Exclude<(typeof workspacePlanEnum.enumValues)[number], "free">[];

export const paidPlanSchema = z.enum(
  paidPlanValues as [string, ...string[]],
);

export type PaidPlan = z.infer<typeof paidPlanSchema>;

export const createWorkspaceSchema = z.object({
  name: z.string().min(2, "Workspace name must be at least 2 characters"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers and hyphens"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const onboardingStepSchema = z.enum(["team", "complete"]);

export const completeOnboardingStepSchema = z.object({
  workspaceId: z.string().uuid(),
  step: onboardingStepSchema,
});

export type CompleteOnboardingStepInput = z.infer<typeof completeOnboardingStepSchema>;
