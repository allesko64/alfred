import { describe, expect, it } from "vitest";
import { completeOnboardingStepSchema, createWorkspaceSchema, onboardingStepSchema } from "../src/workspace.schema";

const uuid = "550e8400-e29b-41d4-a716-446655440000";

describe("createWorkspaceSchema", () => {
  it("accepts a valid name and slug", () => {
    const result = createWorkspaceSchema.safeParse({ name: "Acme Co", slug: "acme-co" });
    expect(result.success).toBe(true);
  });

  it("rejects a slug with spaces", () => {
    const result = createWorkspaceSchema.safeParse({ name: "Acme Co", slug: "acme co" });
    expect(result.success).toBe(false);
  });

  it("rejects a slug with uppercase letters", () => {
    const result = createWorkspaceSchema.safeParse({ name: "Acme Co", slug: "Acme-Co" });
    expect(result.success).toBe(false);
  });

  it("rejects a too-short name", () => {
    const result = createWorkspaceSchema.safeParse({ name: "A", slug: "a" });
    expect(result.success).toBe(false);
  });

  it("rejects a too-short slug", () => {
    const result = createWorkspaceSchema.safeParse({ name: "Acme Co", slug: "a" });
    expect(result.success).toBe(false);
  });
});

describe("onboardingStepSchema", () => {
  it("accepts 'team' and 'complete'", () => {
    expect(onboardingStepSchema.safeParse("team").success).toBe(true);
    expect(onboardingStepSchema.safeParse("complete").success).toBe(true);
  });

  it("rejects an unknown step", () => {
    expect(onboardingStepSchema.safeParse("billing").success).toBe(false);
  });
});

describe("completeOnboardingStepSchema", () => {
  it("accepts a valid workspaceId and step", () => {
    const result = completeOnboardingStepSchema.safeParse({ workspaceId: uuid, step: "complete" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid step", () => {
    const result = completeOnboardingStepSchema.safeParse({ workspaceId: uuid, step: "invalid" });
    expect(result.success).toBe(false);
  });
});
