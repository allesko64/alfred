import { describe, expect, it } from "vitest";
import { reviewResultOutSchema } from "../src/review.schema";

const validIssue = {
  title: "Missing null check",
  description: "Crashes if `user` is undefined.",
  importance: "critical",
  file_path: "apps/web/lib/foo.ts",
  line_number: 12,
  related_to: "AC-1",
  suggested_fix: "Add an early return when `user` is undefined.",
};

describe("reviewResultOutSchema — validating an AI model's review JSON before it touches the DB", () => {
  it("accepts a well-formed review with blocking issues", () => {
    const result = reviewResultOutSchema.safeParse({
      summary: "One critical issue found.",
      issues: [validIssue],
      generated_by: "gpt-5.4-mini",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty issues array as a valid 'PR looks good' result", () => {
    const result = reviewResultOutSchema.safeParse({
      summary: "Looks good, no issues.",
      issues: [],
      generated_by: "gpt-5.4-mini",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an issue missing the required `importance` field, instead of silently defaulting it", () => {
    const { importance, ...issueWithoutImportance } = validIssue;
    const result = reviewResultOutSchema.safeParse({
      summary: "One issue found.",
      issues: [issueWithoutImportance],
      generated_by: "gpt-5.4-mini",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an issue with an importance value outside critical/minor", () => {
    const result = reviewResultOutSchema.safeParse({
      summary: "One issue found.",
      issues: [{ ...validIssue, importance: "high" }],
      generated_by: "gpt-5.4-mini",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a response missing the top-level summary field entirely", () => {
    const result = reviewResultOutSchema.safeParse({
      issues: [],
      generated_by: "gpt-5.4-mini",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed shape — e.g. issues sent as an object instead of an array", () => {
    const result = reviewResultOutSchema.safeParse({
      summary: "broken",
      issues: { 0: validIssue },
      generated_by: "gpt-5.4-mini",
    });
    expect(result.success).toBe(false);
  });
});
