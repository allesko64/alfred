import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
  adminAuditLog,
  CREDIT_COSTS,
  features,
  PLAN_CREDITS,
  repositories,
  users,
  workflowRuns,
  workspaceMemberships,
  workspaces,
} from "@alfred/db";
import { adminProcedure, createTRPCRouter } from "../trpc";

const workspacePlanValues = ["free", "pro", "team"] as const;
const workflowStatusValues = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;
const workflowTypeValues = [
  "clarification",
  "prd_generation",
  "task_generation",
  "pr_ingestion",
  "ai_review",
  "re_review",
  "release_readiness",
  "repo_vectorization",
  "changelog_generation",
] as const;

export const adminRouter = createTRPCRouter({
  listUsers: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        userId: users.id,
        email: users.email,
        name: users.name,
        signupDate: users.createdAt,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
        plan: workspaces.plan,
        creditsRemaining: workspaces.creditsRemaining,
      })
      .from(users)
      .leftJoin(workspaces, eq(workspaces.ownerId, users.id))
      .orderBy(desc(users.createdAt));

    const workspaceIds = rows
      .map((r) => r.workspaceId)
      .filter((id): id is string => id !== null);

    const memberCounts = workspaceIds.length
      ? await ctx.db
          .select({
            workspaceId: workspaceMemberships.workspaceId,
            count: sql<number>`count(*)::int`,
          })
          .from(workspaceMemberships)
          .where(
            and(
              inArray(workspaceMemberships.workspaceId, workspaceIds),
              eq(workspaceMemberships.status, "active"),
            ),
          )
          .groupBy(workspaceMemberships.workspaceId)
      : [];

    const memberCountByWorkspace = new Map(
      memberCounts.map((m) => [m.workspaceId, m.count]),
    );

    return rows.map((row) => ({
      userId: row.userId,
      email: row.email,
      name: row.name,
      signupDate: row.signupDate,
      workspaceId: row.workspaceId,
      workspaceName: row.workspaceName,
      plan: row.plan,
      creditsRemaining: row.creditsRemaining,
      creditsLimit: row.plan ? PLAN_CREDITS[row.plan] : null,
      memberCount: row.workspaceId
        ? (memberCountByWorkspace.get(row.workspaceId) ?? 0)
        : null,
    }));
  }),

  changePlan: adminProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        plan: z.enum(workspacePlanValues),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [current] = await ctx.db
        .select({ plan: workspaces.plan })
        .from(workspaces)
        .where(eq(workspaces.id, input.workspaceId))
        .limit(1);

      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [updated] = await ctx.db
        .update(workspaces)
        .set({ plan: input.plan })
        .where(eq(workspaces.id, input.workspaceId))
        .returning({ id: workspaces.id, plan: workspaces.plan });

      if (!updated) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      await ctx.db.insert(adminAuditLog).values({
        adminUserId: ctx.user.id,
        workspaceId: input.workspaceId,
        action: "plan_change",
        details: { from: current.plan, to: input.plan },
      });

      return updated;
    }),

  adjustCredits: adminProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        delta: z.number().int().refine((n) => n !== 0, "Delta must be non-zero"),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(workspaces)
        .set({
          creditsRemaining: sql`greatest(${workspaces.creditsRemaining} + ${input.delta}, 0)`,
        })
        .where(eq(workspaces.id, input.workspaceId))
        .returning({ creditsRemaining: workspaces.creditsRemaining });

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.db.insert(adminAuditLog).values({
        adminUserId: ctx.user.id,
        workspaceId: input.workspaceId,
        action: "credit_adjustment",
        details: {
          delta: input.delta,
          reason: input.reason,
          newBalance: updated.creditsRemaining,
        },
      });

      return updated;
    }),

  listWorkflowRuns: adminProcedure
    .input(
      z.object({
        status: z.enum(workflowStatusValues).optional(),
        workflowType: z.enum(workflowTypeValues).optional(),
        workspaceId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const featureRepo = alias(repositories, "feature_repo");
      const workspaceIdExpr = sql`coalesce(${features.workspaceId}, ${repositories.workspaceId})`;

      const conditions = [
        input.status ? eq(workflowRuns.status, input.status) : undefined,
        input.workflowType
          ? eq(workflowRuns.workflowType, input.workflowType)
          : undefined,
        input.workspaceId ? eq(workspaceIdExpr, input.workspaceId) : undefined,
      ].filter((c): c is NonNullable<typeof c> => c !== undefined);

      const rows = await ctx.db
        .select({
          id: workflowRuns.id,
          workflowType: workflowRuns.workflowType,
          status: workflowRuns.status,
          errorMessage: workflowRuns.errorMessage,
          startedAt: workflowRuns.startedAt,
          completedAt: workflowRuns.completedAt,
          createdAt: workflowRuns.createdAt,
          featureTitle: features.title,
          featureStatus: features.status,
          workspaceName: workspaces.name,
          directRepoFullName: repositories.fullName,
          featureRepoFullName: featureRepo.fullName,
        })
        .from(workflowRuns)
        .leftJoin(features, eq(features.id, workflowRuns.featureId))
        .leftJoin(repositories, eq(repositories.id, workflowRuns.repositoryId))
        .leftJoin(featureRepo, eq(featureRepo.projectId, features.projectId))
        .leftJoin(workspaces, eq(workspaces.id, workspaceIdExpr))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(workflowRuns.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows.map((row) => {
        const durationMs = row.startedAt
          ? (row.completedAt ?? new Date()).getTime() -
            row.startedAt.getTime()
          : null;

        return {
          id: row.id,
          workflowType: row.workflowType,
          status: row.status,
          errorMessage: row.errorMessage,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
          createdAt: row.createdAt,
          featureTitle: row.featureTitle,
          featureStatus: row.featureStatus,
          workspaceName: row.workspaceName,
          repoFullName: row.directRepoFullName ?? row.featureRepoFullName,
          durationMs,
          creditsConsumed:
            (CREDIT_COSTS as Record<string, number>)[row.workflowType] ??
            null,
        };
      });
    }),

  getStats: adminProcedure.query(async ({ ctx }) => {
    const [[userCount], [workspaceCount], [activeRuns], workspacePlans] =
      await Promise.all([
        ctx.db.select({ count: sql<number>`count(*)::int` }).from(users),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(workspaces),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(workflowRuns)
          .where(inArray(workflowRuns.status, ["pending", "running"])),
        ctx.db
          .select({
            plan: workspaces.plan,
            creditsRemaining: workspaces.creditsRemaining,
          })
          .from(workspaces),
      ]);

    const creditsUsedThisCycle = workspacePlans.reduce(
      (sum, ws) => sum + (PLAN_CREDITS[ws.plan] - ws.creditsRemaining),
      0,
    );

    return {
      totalUsers: userCount?.count ?? 0,
      totalWorkspaces: workspaceCount?.count ?? 0,
      activeWorkflowRuns: activeRuns?.count ?? 0,
      creditsUsedThisCycle,
    };
  }),
});
