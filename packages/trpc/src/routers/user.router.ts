import { users } from "@alfred/db";
import { updateDigestPreferencesSchema } from "@alfred/validators";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const userRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }).optional())
    .query(({ input }) => {
      return { greeting: `Hello, ${input?.name ?? "world"}!` };
    }),

  getSession: protectedProcedure.query(({ ctx }) => {
    return { user: ctx.user };
  }),

  getDigestPreferences: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db
      .select({
        digestEnabled: users.digestEnabled,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    return user ?? { digestEnabled: true };
  }),

  updateDigestPreferences: protectedProcedure
    .input(updateDigestPreferencesSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(users.id, ctx.user.id));

      return { ok: true };
    }),
});
