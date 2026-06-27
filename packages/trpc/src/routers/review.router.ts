import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { aiReviews, features, reviewIssues } from "@alfred/db";
import { createTRPCRouter, workspaceProcedure } from "../trpc";

export const reviewRouter = createTRPCRouter({
  getByFeature: workspaceProcedure
    .input(z.object({ workspaceId: z.string().uuid(), featureId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const reviews = await ctx.db
        .select({ review: aiReviews })
        .from(aiReviews)
        .innerJoin(features, eq(features.id, aiReviews.featureId))
        .where(eq(aiReviews.featureId, input.featureId))
        .orderBy(desc(aiReviews.reviewNumber));

      const latestReviewId = reviews[0]?.review.id;
      const issues = latestReviewId
        ? await ctx.db.select().from(reviewIssues).where(eq(reviewIssues.reviewId, latestReviewId))
        : [];

      return {
        reviews: reviews.map((r) => r.review),
        latestIssues: issues,
      };
    }),
});
