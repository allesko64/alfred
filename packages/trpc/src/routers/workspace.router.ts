import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import {
  completeOnboardingStepSchema,
  createWorkspaceSchema,
  inviteMemberSchema,
  membershipRoleValues,
} from "@alfred/validators";
import { and, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  ACTIVE_STATUSES,
  checkBillingLimit,
  checkWorkspaceCreationLimit,
  features,
  IN_REVIEW_STATUSES,
  membershipRoleEnum,
  PLAN_CREDITS,
  users,
  workspaceInvites,
  workspaceMemberships,
  workspaces,
} from "@alfred/db";
import {
  createTRPCRouter,
  protectedProcedure,
  requireWorkspaceRole,
  workspaceInputSchema,
  workspaceProcedure,
} from "../trpc";
import { invalidateMembershipCache } from "../permissions";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Derive enum values directly from the DB enum — no manual duplication.
const workspacePlanValues = ["free", "pro", "team"] as const;
const billingStatusValues = [
  "active",
  "past_due",
  "cancelled",
  "trialing",
] as const;
const onboardingStepValues = ["team", "complete"] as const;

const workspaceOutputSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  ownerId: z.string().uuid(),
  plan: z.enum(workspacePlanValues),
  billingStatus: z.enum(billingStatusValues),
  onboardingStep: z.enum(onboardingStepValues),
  buildingType: z.string().nullable(),
  creditsRemaining: z.number(),
  creditsResetAt: z.date(),
  createdAt: z.date(),
});

export const workspaceRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/workspace.create",
        tags: ["workspace"],
      },
    })
    .input(createWorkspaceSchema)
    .output(workspaceOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.slug, input.slug))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That slug is already taken",
        });
      }

      const [nameTaken] = await ctx.db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          and(
            eq(workspaces.ownerId, ctx.user.id),
            eq(workspaces.name, input.name),
          ),
        )
        .limit(1);

      if (nameTaken) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have a workspace with that name",
        });
      }

      const workspaceLimit = await checkWorkspaceCreationLimit(ctx.user.id);
      if (!workspaceLimit.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "You've reached the workspace limit for your plan. Upgrade an existing workspace to create more.",
        });
      }

      const [workspace] = await ctx.db
        .insert(workspaces)
        .values({
          name: input.name,
          slug: input.slug,
          ownerId: ctx.user.id,
        })
        .returning();

      if (!workspace) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      await ctx.db.insert(workspaceMemberships).values({
        userId: ctx.user.id,
        workspaceId: workspace.id,
        role: "owner",
        status: "active",
      });

      return workspace;
    }),

  getById: workspaceProcedure
    .input(workspaceInputSchema)
    .query(async ({ ctx }) => {
      const [workspace] = await ctx.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, ctx.workspaceId))
        .limit(1);

      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return { ...workspace, role: ctx.role };
    }),

  list: protectedProcedure
    .meta({
      openapi: { method: "GET", path: "/workspace.list", tags: ["workspace"] },
    })
    .input(z.object({}).optional())
    .output(
      z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          slug: z.string(),
          plan: z.enum(workspacePlanValues),
          onboardingStep: z.enum(onboardingStepValues),
          role: z.enum(membershipRoleEnum.enumValues),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      return ctx.db
        .select({
          id: workspaces.id,
          name: workspaces.name,
          slug: workspaces.slug,
          plan: workspaces.plan,
          onboardingStep: workspaces.onboardingStep,
          role: workspaceMemberships.role,
        })
        .from(workspaceMemberships)
        .innerJoin(
          workspaces,
          eq(workspaces.id, workspaceMemberships.workspaceId),
        )
        .where(eq(workspaceMemberships.userId, ctx.user.id));
    }),

  checkCreationLimit: protectedProcedure
    .input(z.object({}).optional())
    .output(
      z.object({
        allowed: z.boolean(),
        current: z.number(),
        limit: z.number(),
      }),
    )
    .query(async ({ ctx }) => {
      return checkWorkspaceCreationLimit(ctx.user.id);
    }),

  listMembers: workspaceProcedure
    .input(workspaceInputSchema)
    .query(async ({ ctx }) => {
      return ctx.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        })
        .from(workspaceMemberships)
        .innerJoin(users, eq(users.id, workspaceMemberships.userId))
        .where(eq(workspaceMemberships.workspaceId, ctx.workspaceId));
    }),

  getDashboardStats: workspaceProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/workspace.getDashboardStats",
        tags: ["workspace"],
      },
    })
    .input(workspaceInputSchema)
    .output(
      z.object({
        activeFeatures: z.number(),
        inReview: z.number(),
        shippedThisMonth: z.number(),
        aiCreditsRemaining: z.number(),
        aiCreditsLimit: z.number(),
      }),
    )
    .query(async ({ ctx }) => {
      const [workspace] = await ctx.db
        .select({
          plan: workspaces.plan,
          creditsRemaining: workspaces.creditsRemaining,
        })
        .from(workspaces)
        .where(eq(workspaces.id, ctx.workspaceId))
        .limit(1);

      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const countFeatures = (extra: SQL) =>
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(features)
          .where(and(eq(features.workspaceId, ctx.workspaceId), extra))
          .then(([row]) => row?.count ?? 0);

      const [activeCount, inReviewCount, shippedThisMonthCount] =
        await Promise.all([
          countFeatures(inArray(features.status, ACTIVE_STATUSES)),
          countFeatures(inArray(features.status, IN_REVIEW_STATUSES)),
          countFeatures(
            and(
              eq(features.status, "SHIPPED"),
              gte(features.shippedAt, monthStart),
              lt(features.shippedAt, nextMonthStart),
            )!,
          ),
        ]);

      return {
        activeFeatures: activeCount,
        inReview: inReviewCount,
        shippedThisMonth: shippedThisMonthCount,
        aiCreditsRemaining: Math.max(workspace.creditsRemaining, 0),
        aiCreditsLimit: PLAN_CREDITS[workspace.plan],
      };
    }),

  getOnboardingStatus: workspaceProcedure
    .input(workspaceInputSchema)
    .query(async ({ ctx }) => {
      const [workspace] = await ctx.db
        .select({ onboardingStep: workspaces.onboardingStep })
        .from(workspaces)
        .where(eq(workspaces.id, ctx.workspaceId))
        .limit(1);

      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return workspace;
    }),

  completeOnboardingStep: workspaceProcedure
    .input(completeOnboardingStepSchema)
    .mutation(async ({ ctx, input }) => {
      const [workspace] = await ctx.db
        .update(workspaces)
        .set({ onboardingStep: input.step })
        .where(eq(workspaces.id, ctx.workspaceId))
        .returning({ onboardingStep: workspaces.onboardingStep });

      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return workspace;
    }),

  removeMember: workspaceProcedure
    .use(requireWorkspaceRole(["owner", "admin"]))
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        memberId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      // Prevent the workspace owner from removing themselves.
      if (ctx.user.id === input.memberId && ctx.role === "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Workspace owners cannot remove themselves.",
        });
      }

      await ctx.db
        .delete(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, ctx.workspaceId),
            eq(workspaceMemberships.userId, input.memberId),
          ),
        );

      await invalidateMembershipCache(input.memberId, ctx.workspaceId);
      return { ok: true };
    }),

  updateMemberRole: workspaceProcedure
    .use(requireWorkspaceRole(["owner", "admin"]))
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        memberId: z.string().uuid(),
        role: z.enum(membershipRoleValues),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // "owner" role can only be set at workspace creation — not reassigned.
      if (input.role === "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "The owner role cannot be assigned after workspace creation.",
        });
      }

      await ctx.db
        .update(workspaceMemberships)
        .set({ role: input.role })
        .where(
          and(
            eq(workspaceMemberships.workspaceId, ctx.workspaceId),
            eq(workspaceMemberships.userId, input.memberId),
          ),
        );

      await invalidateMembershipCache(input.memberId, ctx.workspaceId);
      return { ok: true };
    }),

  inviteMember: workspaceProcedure
    .use(requireWorkspaceRole(["owner", "admin"]))
    .input(inviteMemberSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const limit = await checkBillingLimit(ctx.workspaceId, "members");
      if (!limit.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "You've reached your plan's team member limit. Upgrade for more.",
          cause: { billingLimit: true },
        });
      }

      const [invite] = await ctx.db
        .insert(workspaceInvites)
        .values({
          workspaceId: ctx.workspaceId,
          invitedBy: ctx.user.id,
          githubUsername: input.githubUsername,
          email: input.email,
          role: input.role,
          token: randomUUID(),
          status: "pending",
          expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
        })
        .returning();

      if (!invite) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      return invite;
    }),
});
