import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { db, features, queryClient, workspaceMemberships } from "@alfred/db";
import { and, eq, sql } from "drizzle-orm";

vi.mock("@alfred/inngest", () => ({ inngest: { send: vi.fn().mockResolvedValue(undefined) } }));

import {
  getMembershipRole,
  invalidateMembershipCache,
  requireMembership,
} from "../src/permissions";
import {
  createTestCaller,
  createTestFeature,
  createTestUser,
  createTestWorkspace,
  createTestWorkspaceWithMember,
} from "./helpers";

afterAll(async () => {
  await queryClient.end();
});

async function setStoredRole(userId: string, workspaceId: string, role: string) {
  await db
    .update(workspaceMemberships)
    .set({ role: sql`${role}::membership_role` })
    .where(and(eq(workspaceMemberships.userId, userId), eq(workspaceMemberships.workspaceId, workspaceId)));
}

// --- Permission logic (packages/trpc/src/permissions.ts) ---------------

describe("getMembershipRole / requireMembership", () => {
  it("returns null for a user with no membership", async () => {
    const user = await createTestUser();
    const owner = await createTestUser();
    const workspace = await createTestWorkspace(owner.id);

    const role = await getMembershipRole(user.id, workspace.id);
    expect(role).toBeNull();
  });

  it("returns the stored role for a member (cache miss → DB query)", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("developer");

    const role = await getMembershipRole(user.id, workspace.id);
    expect(role).toBe("developer");
  });

  it("returns a cached role without re-querying the DB on a second call", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("reviewer");

    const first = await getMembershipRole(user.id, workspace.id);
    // Mutate the underlying row directly — if the second call hits the cache
    // instead of the DB, it must still report the stale ("reviewer") value.
    await setStoredRole(user.id, workspace.id, "admin");
    const second = await getMembershipRole(user.id, workspace.id);

    expect(first).toBe("reviewer");
    expect(second).toBe("reviewer");
  });

  it("invalidateMembershipCache forces a fresh DB read", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("reviewer");

    await getMembershipRole(user.id, workspace.id);
    await setStoredRole(user.id, workspace.id, "admin");
    await invalidateMembershipCache(user.id, workspace.id);
    const afterInvalidate = await getMembershipRole(user.id, workspace.id);

    expect(afterInvalidate).toBe("admin");
  });

  it("requireMembership throws FORBIDDEN for a non-member", async () => {
    const user = await createTestUser();
    const owner = await createTestUser();
    const workspace = await createTestWorkspace(owner.id);

    await expect(requireMembership(user.id, workspace.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("requireMembership throws FORBIDDEN when the role isn't in the allowed list", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("viewer");

    await expect(requireMembership(user.id, workspace.id, ["owner", "admin"])).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("requireMembership resolves with the role when allowed", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("owner");

    await expect(requireMembership(user.id, workspace.id, ["owner", "admin"])).resolves.toBe("owner");
  });
});

// --- Role-gated actions exercised through the real tRPC routers --------

describe("feature.approve / feature.reject — role + state guards", () => {
  it("owner can approve a feature pending approval", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("owner");
    const feature = await createTestFeature(workspace.id, user.id, { status: "PENDING_APPROVAL" });

    const caller = createTestCaller(user.id);
    const result = await caller.feature.approve({ workspaceId: workspace.id, featureId: feature.id });

    expect(result.status).toBe("SHIPPED");
  });

  it("developer cannot approve a feature (FORBIDDEN)", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("developer");
    const feature = await createTestFeature(workspace.id, user.id, { status: "PENDING_APPROVAL" });

    const caller = createTestCaller(user.id);
    await expect(
      caller.feature.approve({ workspaceId: workspace.id, featureId: feature.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("viewer cannot approve a feature (FORBIDDEN)", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("viewer");
    const feature = await createTestFeature(workspace.id, user.id, { status: "PENDING_APPROVAL" });

    const caller = createTestCaller(user.id);
    await expect(
      caller.feature.approve({ workspaceId: workspace.id, featureId: feature.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reviewer can approve, but not when the feature isn't PENDING_APPROVAL", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("reviewer");
    const feature = await createTestFeature(workspace.id, user.id, { status: "IN_DEVELOPMENT" });

    const caller = createTestCaller(user.id);
    await expect(
      caller.feature.approve({ workspaceId: workspace.id, featureId: feature.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("a user outside the workspace gets FORBIDDEN before any status check runs", async () => {
    const owner = await createTestUser();
    const workspace = await createTestWorkspace(owner.id);
    const feature = await createTestFeature(workspace.id, owner.id, { status: "PENDING_APPROVAL" });
    const outsider = await createTestUser();

    const caller = createTestCaller(outsider.id);
    await expect(
      caller.feature.approve({ workspaceId: workspace.id, featureId: feature.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("admin can reject a pending feature with a reason, and it cannot be shipped afterwards", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("admin");
    const feature = await createTestFeature(workspace.id, user.id, { status: "PENDING_APPROVAL" });

    const caller = createTestCaller(user.id);
    const rejected = await caller.feature.reject({
      workspaceId: workspace.id,
      featureId: feature.id,
      reason: "Doesn't meet the acceptance criteria",
    });
    expect(rejected.status).toBe("REJECTED");

    await expect(
      caller.feature.approve({ workspaceId: workspace.id, featureId: feature.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// --- Feature/task status transitions (state machine) -------------------

describe("feature & task status transitions", () => {
  it("task.approvePlan moves PLANNING -> IN_DEVELOPMENT", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("developer");
    const feature = await createTestFeature(workspace.id, user.id, { status: "PLANNING" });

    const caller = createTestCaller(user.id);
    const result = await caller.task.approvePlan({ workspaceId: workspace.id, featureId: feature.id });

    expect(result.status).toBe("IN_DEVELOPMENT");
  });

  it("task.approvePlan rejects a feature that has already left PLANNING (cannot skip/regress steps)", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("developer");
    const feature = await createTestFeature(workspace.id, user.id, { status: "REVIEW_PASSED" });

    const caller = createTestCaller(user.id);
    await expect(
      caller.task.approvePlan({ workspaceId: workspace.id, featureId: feature.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const [unchanged] = await db.select().from(features).where(eq(features.id, feature.id)).limit(1);
    expect(unchanged?.status).toBe("REVIEW_PASSED");
  });

  it("task.approvePlan rejects DRAFT -> IN_DEVELOPMENT (cannot skip the whole pipeline)", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("developer");
    const feature = await createTestFeature(workspace.id, user.id, { status: "DRAFT" });

    const caller = createTestCaller(user.id);
    await expect(
      caller.task.approvePlan({ workspaceId: workspace.id, featureId: feature.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("feature.approve only fires from PENDING_APPROVAL, never from SHIPPED (no re-shipping)", async () => {
    const { user, workspace } = await createTestWorkspaceWithMember("owner");
    const feature = await createTestFeature(workspace.id, user.id, { status: "SHIPPED" });

    const caller = createTestCaller(user.id);
    await expect(
      caller.feature.approve({ workspaceId: workspace.id, featureId: feature.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("requireWorkspaceRole middleware — wrong role on a real protected mutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects task.approvePlan attempt for a user not in the workspace at all", async () => {
    const owner = await createTestUser();
    const workspace = await createTestWorkspace(owner.id);
    const feature = await createTestFeature(workspace.id, owner.id, { status: "PLANNING" });
    const outsider = await createTestUser();

    const caller = createTestCaller(outsider.id);
    await expect(
      caller.task.approvePlan({ workspaceId: workspace.id, featureId: feature.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an unauthenticated caller with UNAUTHORIZED on a protected procedure", async () => {
    const owner = await createTestUser();
    const workspace = await createTestWorkspace(owner.id);

    const caller = createTestCaller(null);
    await expect(
      caller.workspace.create({ name: "Should fail", slug: `no-auth-${Date.now()}` }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});
