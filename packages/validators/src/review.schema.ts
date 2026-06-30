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

export const reviewResultOutSchema = z.object({
  summary: z.string(),
  issues: z.array(reviewIssueOutSchema),
  generated_by: z.string(),
});

export type ReviewResultOut = z.infer<typeof reviewResultOutSchema>;
