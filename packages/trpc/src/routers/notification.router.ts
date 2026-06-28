import { and, desc, eq } from "drizzle-orm";
import { notifications } from "@alfred/db";
import {
  createTRPCRouter,
  protectedProcedure,
  workspaceInputSchema,
  workspaceProcedure,
} from "../trpc";

export const notificationRouter = createTRPCRouter({
  getUnread: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.isRead, false)))
      .orderBy(desc(notifications.createdAt));
  }),

  getWorkspaceActivity: workspaceProcedure.input(workspaceInputSchema).query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(notifications)
      .where(eq(notifications.workspaceId, ctx.workspaceId))
      .orderBy(desc(notifications.createdAt))
      .limit(20);
  }),
});
