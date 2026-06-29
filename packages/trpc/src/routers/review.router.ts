import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { aiReviews, reviewIssues, workflowRuns } from "@alfred/db";
import { createTRPCRouter, workspaceProcedure } from "../trpc";

export const reviewRouter = createTRPCRouter({
  /** All review cycles for a feature, newest first, each with its own issues. Decision 4/5. */
  getByFeature: workspaceProcedure
    .input(z.object({ workspaceId: z.string().uuid(), featureId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const reviews = await ctx.db
        .select()
        .from(aiReviews)
        .where(eq(aiReviews.featureId, input.featureId))
        .orderBy(desc(aiReviews.reviewNumber));

      if (reviews.length === 0) {
        return { reviews: [] };
      }

      const allIssues = await ctx.db
        .select()
        .from(reviewIssues)
        .where(inArray(reviewIssues.reviewId, reviews.map((r) => r.id)));

      const issuesByReviewId = new Map<string, typeof allIssues>();
      for (const issue of allIssues) {
        const list = issuesByReviewId.get(issue.reviewId) ?? [];
        list.push(issue);
        issuesByReviewId.set(issue.reviewId, list);
      }

      return {
        reviews: reviews.map((review) => ({
          ...review,
          issues: issuesByReviewId.get(review.id) ?? [],
        })),
      };
    }),

  /** Latest ai_review/re_review workflow run for a feature — drives the running/debounce-banner states. */
  getWorkflowStatus: workspaceProcedure
    .input(z.object({ workspaceId: z.string().uuid(), featureId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [run] = await ctx.db
        .select()
        .from(workflowRuns)
        .where(
          and(
            inArray(workflowRuns.workflowType, ["ai_review", "re_review"]),
            eq(workflowRuns.featureId, input.featureId),
          ),
        )
        .orderBy(desc(workflowRuns.createdAt))
        .limit(1);

      return run ?? null;
    }),
});
