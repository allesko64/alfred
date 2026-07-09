import { z } from "zod";

export const reviewIssueOutSchema = z.object({
  title: z.string(),
  description: z.string(),
  importance: z.enum(["critical", "minor"]),
  file_path: z.string().nullable(),
  line_number: z.number().int().nullable(),
  related_to: z.string(),
  suggested_fix: z.string(),
});

export type ReviewIssueOut = z.infer<typeof reviewIssueOutSchema>;

/** The model's explicit ruling on one previously flagged issue (labelled PREV-n in the prompt). */
export const previousIssueVerdictSchema = z.object({
  issue_ref: z.string(),
  verdict: z.enum(["resolved", "still_present"]),
  evidence: z.string(),
});

export type PreviousIssueVerdict = z.infer<typeof previousIssueVerdictSchema>;

export const reviewResultOutSchema = z.object({
  summary: z.string(),
  issues: z.array(reviewIssueOutSchema),
  // Defaulted so first reviews (no previous issues) parse even when the model omits the field.
  previous_issue_verdicts: z.array(previousIssueVerdictSchema).default([]),
  generated_by: z.string(),
});

export type ReviewResultOut = z.infer<typeof reviewResultOutSchema>;
