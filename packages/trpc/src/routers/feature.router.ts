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
  checkBillingLimit,
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
import { createTRPCRouter, requireWorkspaceRole, workspaceInputSchema, workspaceProcedure } from "../trpc";

const APPROVER_ROLES = ["owner", "admin", "reviewer"] as const;

const PIPELINE_STAGES = [
  { key: "draft", label: "Draft", statuses: ["DRAFT"] },
  { key: "clarifying", label: "Clarifying", statuses: ["CLARIFYING"] },
  { key: "prd_ready", label: "PRD Ready", statuses: ["PRD_READY"] },
  { key: "in_development", label: "In Development", statuses: ["IN_DEVELOPMENT"] },
  { key: "in_review", label: "In Review", statuses: ["REVIEWING", "RE_REVIEWING"] },
  { key: "shipped", label: "Shipped", statuses: ["SHIPPED"] },
] as const;

export const featureRouter = createTRPCRouter({
  create: workspaceProcedure
    .input(createFeatureSchema)
    .mutation(async ({ ctx, input }) => {
      const limit = await checkBillingLimit(ctx.workspaceId, "features");
      if (!limit.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You've reached your free plan limit. Upgrade to Pro.",
        });
      }

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

      await inngest.send({
        name: "feature/clarification.requested",
        data: { featureId: feature.id },
      });

      return feature;
    }),

  submitClarificationReply: workspaceProcedure
    .input(submitClarificationReplySchema.extend({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
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
    .input(z.object({ workspaceId: z.string().uuid(), featureId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
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
    .input(z.object({ workspaceId: z.string().uuid(), featureId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
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

  list: workspaceProcedure.input(workspaceInputSchema).query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(features)
      .where(eq(features.workspaceId, ctx.workspaceId))
      .orderBy(desc(features.updatedAt));
  }),

  getById: workspaceProcedure
    .input(z.object({ workspaceId: z.string().uuid(), featureId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          feature: features,
          createdByName: users.name,
          createdByEmail: users.email,
        })
        .from(features)
        .innerJoin(users, eq(users.id, features.createdBy))
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return { ...row.feature, createdByName: row.createdByName, createdByEmail: row.createdByEmail };
    }),

  delete: workspaceProcedure
    .input(z.object({ workspaceId: z.string().uuid(), featureId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.db.delete(workflowRuns).where(eq(workflowRuns.featureId, input.featureId));
      await ctx.db.delete(aiReviews).where(eq(aiReviews.featureId, input.featureId));
      await ctx.db.delete(pullRequests).where(eq(pullRequests.featureId, input.featureId));
      await ctx.db.delete(notifications).where(eq(notifications.featureId, input.featureId));
      await ctx.db.delete(prds).where(eq(prds.featureId, input.featureId));
      await ctx.db.delete(features).where(eq(features.id, input.featureId));

      return { ok: true };
    }),

  getStatusCounts: workspaceProcedure.input(workspaceInputSchema).query(async ({ ctx }) => {
    return ctx.db
      .select({ status: features.status, count: sql<number>`count(*)::int` })
      .from(features)
      .where(eq(features.workspaceId, ctx.workspaceId))
      .groupBy(features.status);
  }),

  /** The 6-stage pipeline shown on the dashboard (a curated view, not a 1:1 status dump). */
  getPipelineCounts: workspaceProcedure.input(workspaceInputSchema).query(async ({ ctx }) => {
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
        .filter((row) => (stage.statuses as readonly string[]).includes(row.status))
        .reduce((sum, row) => sum + row.count, 0),
    }));
  }),

  getRecent: workspaceProcedure.input(workspaceInputSchema).query(async ({ ctx }) => {
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
    .input(z.object({ workspaceId: z.string().uuid(), featureId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ feature: features, createdByName: users.name, createdByEmail: users.email })
        .from(features)
        .innerJoin(users, eq(users.id, features.createdBy))
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [prd] = await ctx.db.select().from(prds).where(eq(prds.featureId, input.featureId)).limit(1);
      const taskRows = await ctx.db.select().from(tasks).where(eq(tasks.featureId, input.featureId));

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
        .where(and(eq(aiReviews.featureId, input.featureId), eq(aiReviews.isArchived, false)))
        .orderBy(desc(aiReviews.reviewNumber))
        .limit(1);

      const [readinessRun] = await ctx.db
        .select()
        .from(workflowRuns)
        .where(
          and(eq(workflowRuns.featureId, input.featureId), eq(workflowRuns.workflowType, "release_readiness")),
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
    .input(z.object({ workspaceId: z.string().uuid(), featureId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({ id: features.id })
        .from(features)
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
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
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (feature.status !== "PENDING_APPROVAL") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Feature is not pending approval" });
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
        .where(and(eq(features.id, input.featureId), eq(features.workspaceId, ctx.workspaceId)))
        .limit(1);

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (feature.status !== "PENDING_APPROVAL") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Feature is not pending approval" });
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
