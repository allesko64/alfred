import { describe, expect, it } from "vitest";
import { inviteMemberSchema, membershipRoleValues } from "../src/invite.schema";

const uuid = "550e8400-e29b-41d4-a716-446655440000";

describe("inviteMemberSchema", () => {
  it("accepts an invite by email", () => {
    const result = inviteMemberSchema.safeParse({
      workspaceId: uuid,
      email: "dev@example.com",
      role: "developer",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an invite by githubUsername", () => {
    const result = inviteMemberSchema.safeParse({
      workspaceId: uuid,
      githubUsername: "octocat",
      role: "viewer",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invite with neither email nor githubUsername", () => {
    const result = inviteMemberSchema.safeParse({ workspaceId: uuid, role: "developer" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid role", () => {
    const result = inviteMemberSchema.safeParse({
      workspaceId: uuid,
      email: "dev@example.com",
      role: "superadmin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = inviteMemberSchema.safeParse({
      workspaceId: uuid,
      email: "not-an-email",
      role: "developer",
    });
    expect(result.success).toBe(false);
  });

  it("exposes exactly the five membership roles", () => {
    expect(membershipRoleValues).toEqual(["owner", "admin", "developer", "reviewer", "viewer"]);
  });
});
