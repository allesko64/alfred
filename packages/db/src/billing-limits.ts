import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "./client";
import { repositories, workspaceMemberships, workspaces, type WorkspacePlan } from "./schema";

/** Monthly AI credit allowance per plan. Resets via cron and on plan change. */
export const PLAN_CREDITS: Record<WorkspacePlan, number> = {
  free: 100,
  pro: 2000,
  team: 10000,
};

/** Credits consumed per AI action. Same across all plans. */
export const CREDIT_COSTS = {
  prd_generation: 10,
  task_generation: 5,
  ai_review: 15,
  re_review: 10,
  clarification_message: 1,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

export type BillingLimitType = "repos" | "members";

/** Hard caps on repos/members — these don't consume credits, just cap a count. */
const PLAN_LIMITS: Record<BillingLimitType, Record<WorkspacePlan, number>> = {
  repos: { free: 1, pro: 3, team: Infinity },
  members: { free: 1, pro: 5, team: 25 },
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

/** Checks a hard repo/member cap for the workspace's current plan. */
export async function checkBillingLimit(
  workspaceId: string,
  limitType: BillingLimitType,
): Promise<BillingLimitResult> {
  const [workspace] = await db
    .select({ plan: workspaces.plan })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  const plan = workspace?.plan ?? "free";
  const limit = PLAN_LIMITS[limitType][plan];
  const current = await COUNTERS[limitType](workspaceId);

  return { allowed: current < limit, current, limit };
}

export interface CreditCheckResult {
  allowed: boolean;
  remaining: number;
  cost: number;
}

/**
 * Atomically checks and deducts credits in one statement, so concurrent
 * requests can't both pass the check before either deduction lands.
 */
export async function checkAndDeductCredits(workspaceId: string, action: CreditAction): Promise<CreditCheckResult> {
  const cost = CREDIT_COSTS[action];

  const [deducted] = await db
    .update(workspaces)
    .set({ creditsRemaining: sql`${workspaces.creditsRemaining} - ${cost}` })
    .where(and(eq(workspaces.id, workspaceId), gte(workspaces.creditsRemaining, cost)))
    .returning({ creditsRemaining: workspaces.creditsRemaining });

  if (deducted) {
    return { allowed: true, remaining: deducted.creditsRemaining, cost };
  }

  const [workspace] = await db
    .select({ creditsRemaining: workspaces.creditsRemaining })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  return { allowed: false, remaining: workspace?.creditsRemaining ?? 0, cost };
}

export async function getCreditsStatus(workspaceId: string): Promise<{ remaining: number; limit: number }> {
  const [workspace] = await db
    .select({ plan: workspaces.plan, creditsRemaining: workspaces.creditsRemaining })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  const plan = workspace?.plan ?? "free";
  return { remaining: workspace?.creditsRemaining ?? 0, limit: PLAN_CREDITS[plan] };
}
