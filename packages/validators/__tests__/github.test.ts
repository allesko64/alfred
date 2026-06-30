import { describe, expect, it } from "vitest";
import { connectGithubSchema, connectRepositorySchema } from "../src/github.schema";

const uuid = "550e8400-e29b-41d4-a716-446655440000";

describe("connectGithubSchema", () => {
  it("accepts a valid installation_id", () => {
    const result = connectGithubSchema.safeParse({ workspaceId: uuid, installationId: 12345 });
    expect(result.success).toBe(true);
  });

  it("rejects a missing installation_id", () => {
    const result = connectGithubSchema.safeParse({ workspaceId: uuid });
    expect(result.success).toBe(false);
  });

  it("rejects a negative installation_id", () => {
    const result = connectGithubSchema.safeParse({ workspaceId: uuid, installationId: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer installation_id", () => {
    const result = connectGithubSchema.safeParse({ workspaceId: uuid, installationId: 1.5 });
    expect(result.success).toBe(false);
  });
});

describe("connectRepositorySchema", () => {
  it("accepts valid workspace, installation and repo ids", () => {
    const result = connectRepositorySchema.safeParse({
      workspaceId: uuid,
      installationId: 1,
      githubRepoId: 2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing githubRepoId", () => {
    const result = connectRepositorySchema.safeParse({ workspaceId: uuid, installationId: 1 });
    expect(result.success).toBe(false);
  });
});
