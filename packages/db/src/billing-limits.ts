import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "./client";
import {
  aiReviews,
  features,
  prds,
  repositories,
  workspaceMemberships,
  workspaces,
} from "./schema";

export type BillingLimitType = "features" | "prd_generations" | "ai_reviews" | "repos" | "members";

/** Free plan caps from execution_plan.md Phase 11.2. Pro/Team are unlimited. */
const FREE_PLAN_LIMITS: Record<BillingLimitType, number> = {
  features: 3,
  prd_generations: 2,
  ai_reviews: 5,
  repos: 1,
  members: 1,
};

export interface BillingLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
}

async function count(query: Promise<{ count: number }[]>): Promise<number> {
  const [row] = await query;
  return row?.count ?? 0;
}

const COUNTERS: Record<BillingLimitType, (workspaceId: string) => Promise<number>> = {
  features: (workspaceId) =>
    count(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(features)
        .where(eq(features.workspaceId, workspaceId)),
    ),
  prd_generations: (workspaceId) =>
    count(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(prds)
        .innerJoin(features, eq(features.id, prds.featureId))
        .where(eq(features.workspaceId, workspaceId)),
    ),
  ai_reviews: (workspaceId) =>
    count(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiReviews)
        .innerJoin(features, eq(features.id, aiReviews.featureId))
        .where(eq(features.workspaceId, workspaceId)),
    ),
  repos: (workspaceId) =>
    count(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(repositories)
        .where(and(eq(repositories.workspaceId, workspaceId), isNull(repositories.disconnectedAt))),
    ),
  members: (workspaceId) =>
    count(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(workspaceMemberships)
        .where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.status, "active"))),
    ),
};

/** Free plan is capped per FREE_PLAN_LIMITS; Pro and Team are unlimited. */
export async function checkBillingLimit(
  workspaceId: string,
  limitType: BillingLimitType,
): Promise<BillingLimitResult> {
  const [workspace] = await db
    .select({ plan: workspaces.plan })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (workspace?.plan !== "free") {
    return { allowed: true, current: 0, limit: Infinity };
  }

  const limit = FREE_PLAN_LIMITS[limitType];
  const current = await COUNTERS[limitType](workspaceId);

  return { allowed: current < limit, current, limit };
}
