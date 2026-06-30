import { afterAll, describe, expect, it, vi } from "vitest";
import {
  checkBillingLimit,
  db,
  projects,
  queryClient,
  repositories,
  workspaceMemberships,
  workspaces,
  type WorkspacePlan,
} from "@alfred/db";
import { eq } from "drizzle-orm";

const { inngestSend } = vi.hoisted(() => ({ inngestSend: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@alfred/inngest", () => ({ inngest: { send: inngestSend } }));

import { createTestCaller, createTestUser, createTestWorkspace, createTestWorkspaceWithMember } from "./helpers";

afterAll(async () => {
  await queryClient.end();
});

async function setPlan(workspaceId: string, plan: WorkspacePlan) {
  await db.update(workspaces).set({ plan }).where(eq(workspaces.id, workspaceId));
}

// --- workspace.router ----------------------------------------------------

describe("workspace.create", () => {
  it("creates a workspace and makes the caller its owner", async () => {
    const user = await createTestUser();
    const caller = createTestCaller(user.id);

    const workspace = await caller.workspace.create({
      name: "Acme Co",
      slug: `acme-${Date.now()}`,
    });

    expect(workspace.ownerId).toBe(user.id);

    const [membership] = await db
      .select()
      .from(workspaceMemberships)
      .where(eq(workspaceMemberships.workspaceId, workspace.id));
    expect(membership?.role).toBe("owner");
  });

  it("rejects a duplicate slug with CONFLICT", async () => {
    const user = await createTestUser();
    const caller = createTestCaller(user.id);
    const slug = `dup-${Date.now()}`;

    await caller.workspace.create({ name: "First", slug });
    await expect(caller.workspace.create({ name: "Second", slug })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});

describe("workspace.getById", () => {
  it("returns the workspace for a member", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("developer");
    const caller = createTestCaller(user.id);

    const result = await caller.workspace.getById({ workspaceId: workspace.id });
    expect(result.id).toBe(workspace.id);
  });

  it("returns FORBIDDEN for a non-member", async () => {
    const owner = await createTestUser();
    const workspace = await createTestWorkspace(owner.id);
    const outsider = await createTestUser();
    const caller = createTestCaller(outsider.id);

    await expect(caller.workspace.getById({ workspaceId: workspace.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("workspace.inviteMember — role gate + member billing limit", () => {
  it("owner can invite while under the plan's member limit", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("owner");
    await setPlan(workspace.id, "pro"); // pro allows 5 members, only 1 (owner) exists

    const caller = createTestCaller(user.id);
    await expect(
      caller.workspace.inviteMember({ workspaceId: workspace.id, email: "new@dev.com", role: "developer" }),
    ).resolves.toBeDefined();
  });

  it("viewer cannot invite members (FORBIDDEN before the billing check even runs)", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("viewer");

    const caller = createTestCaller(user.id);
    await expect(
      caller.workspace.inviteMember({ workspaceId: workspace.id, email: "new@dev.com", role: "developer" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("free plan blocks a 2nd member once the workspace is already at its 1-member cap", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("owner");
    // Workspace already has 1 active member (the owner) — free plan's cap is 1.

    const caller = createTestCaller(user.id);
    await expect(
      caller.workspace.inviteMember({ workspaceId: workspace.id, email: "new@dev.com", role: "developer" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// --- feature.router — credits gate clarification, not creation ----------

describe("feature.create — creation is never gated, only the AI follow-up is", () => {
  it("succeeds even when the workspace has zero AI credits remaining", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("developer");
    await db.update(workspaces).set({ creditsRemaining: 0 }).where(eq(workspaces.id, workspace.id));

    const caller = createTestCaller(user.id);
    const feature = await caller.feature.create({
      workspaceId: workspace.id,
      content: "Add dark mode support to the dashboard",
    });

    expect(feature.status).toBe("CLARIFYING");
    // Out of credits means Alfred never gets asked to reply — no clarification event fired.
    expect(inngestSend).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "feature/clarification.requested" }),
    );
  });

  it("fires the clarification workflow when credits are available", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("developer");
    inngestSend.mockClear();

    const caller = createTestCaller(user.id);
    await caller.feature.create({
      workspaceId: workspace.id,
      content: "Add dark mode support to the dashboard",
    });

    expect(inngestSend).toHaveBeenCalledWith(expect.objectContaining({ name: "feature/clarification.requested" }));
  });
});

describe("feature.submitClarificationReply — credits gate", () => {
  it("blocks the reply once the workspace is out of credits", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("developer");
    const caller = createTestCaller(user.id);
    const feature = await caller.feature.create({
      workspaceId: workspace.id,
      content: "Add dark mode support to the dashboard",
    });

    await db.update(workspaces).set({ creditsRemaining: 0 }).where(eq(workspaces.id, workspace.id));

    await expect(
      caller.feature.submitClarificationReply({
        workspaceId: workspace.id,
        featureId: feature.id,
        content: "Web only for now.",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// --- billing gates (packages/db/src/billing-limits.ts) via the routers --

describe("checkBillingLimit — repos", () => {
  it("free plan workspace is blocked from connecting a 2nd repo", async () => {
    const { workspace } = await createTestWorkspaceWithMember("owner");
    const [project] = await db
      .insert(projects)
      .values({ workspaceId: workspace.id, name: "Main", createdBy: workspace.ownerId })
      .returning();

    await db.insert(repositories).values({
      projectId: project!.id,
      workspaceId: workspace.id,
      githubRepoId: Date.now(),
      fullName: "acme/repo-one",
      installationId: 1,
    });

    const result = await checkBillingLimit(workspace.id, "repos");

    expect(result).toMatchObject({ allowed: false, current: 1, limit: 1 });
  });

  it("pro plan workspace allows a 2nd repo (limit raised to 3)", async () => {
    const { workspace } = await createTestWorkspaceWithMember("owner");
    await setPlan(workspace.id, "pro");
    const [project] = await db
      .insert(projects)
      .values({ workspaceId: workspace.id, name: "Main", createdBy: workspace.ownerId })
      .returning();

    await db.insert(repositories).values({
      projectId: project!.id,
      workspaceId: workspace.id,
      githubRepoId: Date.now(),
      fullName: "acme/repo-one",
      installationId: 1,
    });

    const result = await checkBillingLimit(workspace.id, "repos");

    expect(result).toMatchObject({ allowed: true, current: 1, limit: 3 });
  });
});

describe("github.connectRepository — repo billing gate enforced at the router layer", () => {
  it("rejects with FORBIDDEN before ever calling the GitHub API once the repo cap is hit", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("owner");
    const [project] = await db
      .insert(projects)
      .values({ workspaceId: workspace.id, name: "Main", createdBy: user.id })
      .returning();
    await db.insert(repositories).values({
      projectId: project!.id,
      workspaceId: workspace.id,
      githubRepoId: Date.now(),
      fullName: "acme/repo-one",
      installationId: 1,
    });

    const caller = createTestCaller(user.id);
    await expect(
      caller.github.connectRepository({
        workspaceId: workspace.id,
        installationId: 1,
        githubRepoId: 99999,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
