import { TRPCError } from "@trpc/server";
import {
  approveFeatureSchema,
  createFeatureSchema,
  rejectFeatureSchema,
  submitClarificationReplySchema,
} from "@alfred/validators";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  aiReviews,
  checkAndDeductCredits,
  clarificationMessages,
  features,
  notifications,
  prds,
  pullRequests,
  tasks,
  users,
  workflowRuns,
} from "@alfred/db";
import { inngest } from "@alfred/inngest";
import {
  createTRPCRouter,
  requireWorkspaceRole,
  workspaceInputSchema,
  workspaceProcedure,
} from "../trpc";

const APPROVER_ROLES = ["owner", "admin", "reviewer"] as const;

// Every feature_status enum value (packages/db/src/schema/enums.ts) must appear
// in exactly one stage below — a status left out here means a feature in that
// status has zero count in any stage, and clicking through a stage's link
// (which filters /features by these statuses) makes it appear to vanish.
// Stages mirror the feature-detail floating dock's segments (Conversation,
// PRD, Tasks, Review, Approval) so the pipeline doesn't surface more phases
// than a feature actually has tabs for.
const PIPELINE_STAGES = [
  {
    key: "conversation",
    label: "Conversation",
    statuses: ["DRAFT", "CLARIFYING"],
  },
  { key: "prd", label: "PRD", statuses: ["PRD_GENERATION", "PRD_READY"] },
  {
    key: "tasks",
    label: "Tasks",
    statuses: ["TASK_GENERATION", "PLANNING", "IN_DEVELOPMENT", "PR_LINKED"],
  },
  {
    key: "review",
    label: "Review",
    statuses: [
      "REVIEWING",
      "CHANGES_REQUESTED",
      "RE_REVIEWING",
      "REVIEW_PASSED",
    ],
  },
  {
    key: "approval",
    label: "Approval",
    statuses: ["PENDING_APPROVAL", "APPROVED", "SHIPPED", "REJECTED"],
  },
] as const;

const featureOutputSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  title: z.string(),
  originalRequest: z.string(),
  status: z.enum([
    "DRAFT",
    "CLARIFYING",
    "PRD_GENERATION",
    "PRD_READY",
    "TASK_GENERATION",
    "PLANNING",
    "IN_DEVELOPMENT",
    "PR_LINKED",
    "REVIEWING",
    "CHANGES_REQUESTED",
    "RE_REVIEWING",
    "REVIEW_PASSED",
    "PENDING_APPROVAL",
    "APPROVED",
    "SHIPPED",
    "REJECTED",
  ]),
  createdBy: z.string().uuid(),
  assignedTo: z.string().uuid().nullable(),
  approvedBy: z.string().uuid().nullable(),
  approvedAt: z.date().nullable(),
  shippedAt: z.date().nullable(),
  rejectedAt: z.date().nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const featureRouter = createTRPCRouter({
  /** Feature creation is always free (never gated) — only the AI clarification round it kicks off costs a credit. */
  create: workspaceProcedure
    .meta({
      openapi: { method: "POST", path: "/feature.create", tags: ["feature"] },
    })
    .input(createFeatureSchema)
    .output(featureOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .insert(features)
        .values({
          workspaceId: ctx.workspaceId,
          projectId: input.projectId,
          title: input.content.slice(0, 60),
          originalRequest: input.content,
          status: "CLARIFYING",
          createdBy: ctx.user.id,
        })
        .returning();

      if (!feature) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      await ctx.db.insert(clarificationMessages).values({
        featureId: feature.id,
        role: "user",
        content: input.content,
      });

      const credits = await checkAndDeductCredits(
        ctx.workspaceId,
        "clarification_message",
      );
      if (credits.allowed) {
        await inngest.send({
          name: "feature/clarification.requested",
          data: { featureId: feature.id },
        });
      } else {
        await ctx.db.insert(notifications).values({
          userId: ctx.user.id,
          workspaceId: ctx.workspaceId,
          type: "credits_exhausted",
          title: "Out of AI credits",
          message:
            "This feature was created, but Alfred can't reply until your credits reset or you upgrade.",
          featureId: feature.id,
        });
      }

      return feature;
    }),

  submitClarificationReply: workspaceProcedure
    .input(
      submitClarificationReplySchema.extend({ workspaceId: z.string().uuid() }),
    )
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(
          and(
            eq(features.id, input.featureId),
            eq(features.workspaceId, ctx.workspaceId),
          ),
        )
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const credits = await checkAndDeductCredits(
        ctx.workspaceId,
        "clarification_message",
      );
      if (!credits.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "You're out of AI credits. Upgrade or wait for your next monthly reset.",
        });
      }

      await ctx.db.insert(clarificationMessages).values({
        featureId: input.featureId,
        role: "user",
        content: input.content,
      });

      await inngest.send({
        name: "feature/clarification.requested",
        data: { featureId: input.featureId },
      });

      return { ok: true };
    }),

  getClarificationMessages: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        featureId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(
          and(
            eq(features.id, input.featureId),
            eq(features.workspaceId, ctx.workspaceId),
          ),
        )
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.db
        .select()
        .from(clarificationMessages)
        .where(eq(clarificationMessages.featureId, input.featureId))
        .orderBy(asc(clarificationMessages.createdAt));
    }),

  getWorkflowProgress: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        featureId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(
          and(
            eq(features.id, input.featureId),
            eq(features.workspaceId, ctx.workspaceId),
          ),
        )
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [run] = await ctx.db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.featureId, input.featureId))
        .orderBy(desc(workflowRuns.createdAt))
        .limit(1);

      return run ?? null;
    }),

  list: workspaceProcedure
    .meta({
      openapi: { method: "GET", path: "/feature.list", tags: ["feature"] },
    })
    .input(workspaceInputSchema)
    .output(z.array(featureOutputSchema))
    .query(async ({ ctx }) => {
      return ctx.db
        .select()
        .from(features)
        .where(eq(features.workspaceId, ctx.workspaceId))
        .orderBy(desc(features.updatedAt));
    }),

  getById: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        featureId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          feature: features,
          createdByName: users.name,
          createdByEmail: users.email,
        })
        .from(features)
        .innerJoin(users, eq(users.id, features.createdBy))
        .where(
          and(
            eq(features.id, input.featureId),
            eq(features.workspaceId, ctx.workspaceId),
          ),
        )
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return {
        ...row.feature,
        createdByName: row.createdByName,
        createdByEmail: row.createdByEmail,
      };
    }),

  delete: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        featureId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(
          and(
            eq(features.id, input.featureId),
            eq(features.workspaceId, ctx.workspaceId),
          ),
        )
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.db
        .delete(workflowRuns)
        .where(eq(workflowRuns.featureId, input.featureId));
      await ctx.db
        .delete(aiReviews)
        .where(eq(aiReviews.featureId, input.featureId));
      await ctx.db
        .delete(pullRequests)
        .where(eq(pullRequests.featureId, input.featureId));
      await ctx.db
        .delete(notifications)
        .where(eq(notifications.featureId, input.featureId));
      await ctx.db.delete(prds).where(eq(prds.featureId, input.featureId));
      await ctx.db.delete(features).where(eq(features.id, input.featureId));

      return { ok: true };
    }),

  getStatusCounts: workspaceProcedure
    .input(workspaceInputSchema)
    .query(async ({ ctx }) => {
      return ctx.db
        .select({ status: features.status, count: sql<number>`count(*)::int` })
        .from(features)
        .where(eq(features.workspaceId, ctx.workspaceId))
        .groupBy(features.status);
    }),

  /** The 6-stage pipeline shown on the dashboard (a curated view, not a 1:1 status dump). */
  getPipelineCounts: workspaceProcedure
    .input(workspaceInputSchema)
    .query(async ({ ctx }) => {
      const statusCounts = await ctx.db
        .select({ status: features.status, count: sql<number>`count(*)::int` })
        .from(features)
        .where(eq(features.workspaceId, ctx.workspaceId))
        .groupBy(features.status);

      return PIPELINE_STAGES.map((stage) => ({
        key: stage.key,
        label: stage.label,
        statuses: stage.statuses,
        count: statusCounts
          .filter((row) =>
            (stage.statuses as readonly string[]).includes(row.status),
          )
          .reduce((sum, row) => sum + row.count, 0),
      }));
    }),

  getRecent: workspaceProcedure
    .input(workspaceInputSchema)
    .query(async ({ ctx }) => {
      return ctx.db
        .select({
          id: features.id,
          title: features.title,
          status: features.status,
          updatedAt: features.updatedAt,
          createdByName: users.name,
          createdByEmail: users.email,
        })
        .from(features)
        .innerJoin(users, eq(users.id, features.createdBy))
        .where(eq(features.workspaceId, ctx.workspaceId))
        .orderBy(desc(features.updatedAt))
        .limit(5);
    }),

  /** Everything the Approval tab needs in one call: PRD, task completion, linked PR, latest review, and the release-readiness check's own progress row. */
  getApprovalDetails: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        featureId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          feature: features,
          createdByName: users.name,
          createdByEmail: users.email,
        })
        .from(features)
        .innerJoin(users, eq(users.id, features.createdBy))
        .where(
          and(
            eq(features.id, input.featureId),
            eq(features.workspaceId, ctx.workspaceId),
          ),
        )
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [prd] = await ctx.db
        .select()
        .from(prds)
        .where(eq(prds.featureId, input.featureId))
        .limit(1);
      const taskRows = await ctx.db
        .select()
        .from(tasks)
        .where(eq(tasks.featureId, input.featureId));

      const [pr] = await ctx.db
        .select({
          id: pullRequests.id,
          githubPrNumber: pullRequests.githubPrNumber,
          title: pullRequests.title,
          status: pullRequests.status,
          htmlUrl: pullRequests.diffUrl,
        })
        .from(pullRequests)
        .where(eq(pullRequests.featureId, input.featureId))
        .limit(1);

      const [latestReview] = await ctx.db
        .select()
        .from(aiReviews)
        .where(
          and(
            eq(aiReviews.featureId, input.featureId),
            eq(aiReviews.isArchived, false),
          ),
        )
        .orderBy(desc(aiReviews.reviewNumber))
        .limit(1);

      const [readinessRun] = await ctx.db
        .select()
        .from(workflowRuns)
        .where(
          and(
            eq(workflowRuns.featureId, input.featureId),
            eq(workflowRuns.workflowType, "release_readiness"),
          ),
        )
        .orderBy(desc(workflowRuns.createdAt))
        .limit(1);

      return {
        feature: row.feature,
        createdByName: row.createdByName,
        createdByEmail: row.createdByEmail,
        prd: prd ?? null,
        tasksTotal: taskRows.length,
        tasksDone: taskRows.filter((t) => t.status === "DONE").length,
        pr: pr ?? null,
        latestReview: latestReview ?? null,
        readinessRun: readinessRun ?? null,
      };
    }),

  /** Manual fallback for the readiness check — e.g. a task got marked DONE after the automatic check already ran and failed. */
  requestReleaseReadinessCheck: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        featureId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(
          and(
            eq(features.id, input.featureId),
            eq(features.workspaceId, ctx.workspaceId),
          ),
        )
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await inngest.send({
        name: "feature/release-readiness.requested",
        data: { featureId: input.featureId },
      });

      return { ok: true };
    }),

  /** Spec 10.2: only owner/admin/reviewer roles may approve — enforced here, not just hidden in the UI. Approve directly ships (10.3). */
  approve: workspaceProcedure
    .use(requireWorkspaceRole([...APPROVER_ROLES]))
    .input(approveFeatureSchema.extend({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select()
        .from(features)
        .where(
          and(
            eq(features.id, input.featureId),
            eq(features.workspaceId, ctx.workspaceId),
          ),
        )
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (feature.status !== "PENDING_APPROVAL") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Feature is not pending approval",
        });
      }

      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const now = new Date();
      const [shipped] = await ctx.db
        .update(features)
        .set({
          status: "SHIPPED",
          approvedBy: ctx.user.id,
          approvedAt: now,
          shippedAt: now,
          updatedAt: now,
        })
        .where(eq(features.id, input.featureId))
        .returning();

      await ctx.db.insert(notifications).values({
        userId: feature.createdBy,
        workspaceId: ctx.workspaceId,
        type: "feature_shipped",
        title: "🎉 Feature shipped!",
        message: `${feature.title} has been approved and shipped.`,
        featureId: input.featureId,
      });

      await inngest.send({
        name: "feature/changelog-generation.requested",
        data: { featureId: input.featureId },
      });

      return shipped;
    }),

  /** Spec 10.2: rejection requires a reason, stored on the feature row for the developer to see. */
  reject: workspaceProcedure
    .use(requireWorkspaceRole([...APPROVER_ROLES]))
    .input(rejectFeatureSchema.extend({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select()
        .from(features)
        .where(
          and(
            eq(features.id, input.featureId),
            eq(features.workspaceId, ctx.workspaceId),
          ),
        )
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (feature.status !== "PENDING_APPROVAL") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Feature is not pending approval",
        });
      }

      const [rejected] = await ctx.db
        .update(features)
        .set({
          status: "REJECTED",
          rejectedAt: new Date(),
          rejectionReason: input.reason,
          updatedAt: new Date(),
        })
        .where(eq(features.id, input.featureId))
        .returning();

      await ctx.db.insert(notifications).values({
        userId: feature.createdBy,
        workspaceId: ctx.workspaceId,
        type: "feature_rejected",
        title: "Feature rejected",
        message: input.reason,
        featureId: input.featureId,
      });

      return rejected;
    }),
});
