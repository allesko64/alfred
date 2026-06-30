import { describe, expect, it } from "vitest";
import {
  approveFeatureSchema,
  createFeatureSchema,
  rejectFeatureSchema,
  submitClarificationReplySchema,
} from "../src/feature.schema";

const uuid = "550e8400-e29b-41d4-a716-446655440000";

describe("createFeatureSchema", () => {
  it("accepts a valid feature request", () => {
    const result = createFeatureSchema.safeParse({
      workspaceId: uuid,
      content: "Add dark mode support to the dashboard",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an optional projectId", () => {
    const result = createFeatureSchema.safeParse({
      workspaceId: uuid,
      projectId: uuid,
      content: "Add dark mode support to the dashboard",
    });
    expect(result.success).toBe(true);
  });

  it("rejects content shorter than 10 characters", () => {
    const result = createFeatureSchema.safeParse({
      workspaceId: uuid,
      content: "too short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing workspaceId", () => {
    const result = createFeatureSchema.safeParse({
      content: "Add dark mode support to the dashboard",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid workspaceId", () => {
    const result = createFeatureSchema.safeParse({
      workspaceId: "not-a-uuid",
      content: "Add dark mode support to the dashboard",
    });
    expect(result.success).toBe(false);
  });
});

describe("submitClarificationReplySchema", () => {
  it("accepts a valid reply", () => {
    const result = submitClarificationReplySchema.safeParse({
      featureId: uuid,
      content: "Yes, web only for now.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = submitClarificationReplySchema.safeParse({
      featureId: uuid,
      content: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("approveFeatureSchema", () => {
  it("accepts a valid featureId", () => {
    expect(approveFeatureSchema.safeParse({ featureId: uuid }).success).toBe(true);
  });

  it("rejects a missing featureId", () => {
    expect(approveFeatureSchema.safeParse({}).success).toBe(false);
  });
});

describe("rejectFeatureSchema", () => {
  it("accepts a valid reason", () => {
    const result = rejectFeatureSchema.safeParse({ featureId: uuid, reason: "Missing edge case handling" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty reason", () => {
    const result = rejectFeatureSchema.safeParse({ featureId: uuid, reason: "" });
    expect(result.success).toBe(false);
  });
});
