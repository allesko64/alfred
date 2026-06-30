import { randomUUID } from "node:crypto";
import { db, features, users, workspaceMemberships, workspaces } from "@alfred/db";
import { appRouter } from "../src/root";
import type { Context } from "../src/context";
import type { MembershipRole } from "../src/permissions";

export type { MembershipRole };

export async function createTestUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const [user] = await db
    .insert(users)
    .values({
      email: overrides.email ?? `${randomUUID()}@test.alfred.dev`,
      name: overrides.name ?? "Test User",
      ...overrides,
    })
    .returning();

  if (!user) throw new Error("Failed to create test user");
  return user;
}

export async function createTestWorkspace(
  ownerId: string,
  overrides: Partial<typeof workspaces.$inferInsert> = {},
) {
  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: overrides.name ?? "Test Workspace",
      slug: overrides.slug ?? `test-ws-${randomUUID()}`,
      ownerId,
      ...overrides,
    })
    .returning();

  if (!workspace) throw new Error("Failed to create test workspace");
  return workspace;
}

export async function addMembership(userId: string, workspaceId: string, role: MembershipRole) {
  const [membership] = await db
    .insert(workspaceMemberships)
    .values({ userId, workspaceId, role, status: "active" })
    .returning();

  if (!membership) throw new Error("Failed to create test membership");
  return membership;
}

/** Convenience: user + workspace + membership in one call. */
export async function createTestWorkspaceWithMember(role: MembershipRole) {
  const user = await createTestUser();
  const workspace = await createTestWorkspace(user.id);
  await addMembership(user.id, workspace.id, role);
  return { user, workspace };
}

export async function createTestFeature(
  workspaceId: string,
  createdBy: string,
  overrides: Partial<typeof features.$inferInsert> = {},
) {
  const [feature] = await db
    .insert(features)
    .values({
      workspaceId,
      title: overrides.title ?? "Test feature",
      originalRequest: overrides.originalRequest ?? "Build a test feature",
      status: overrides.status ?? "DRAFT",
      createdBy,
      ...overrides,
    })
    .returning();

  if (!feature) throw new Error("Failed to create test feature");
  return feature;
}

export function createTestCaller(userId: string | null) {
  const ctx: Context = {
    db,
    session: userId ? { user: { id: userId, email: `${userId}@test.alfred.dev` } } : null,
    user: userId ? { id: userId, email: `${userId}@test.alfred.dev` } : null,
  };
  return appRouter.createCaller(ctx);
}
