import { adminRouter } from "./routers/admin.router";
import { billingRouter } from "./routers/billing.router";
import { changelogRouter } from "./routers/changelog.router";
import { featureRouter } from "./routers/feature.router";
import { githubRouter } from "./routers/github.router";
import { notificationRouter } from "./routers/notification.router";
import { prdRouter } from "./routers/prd.router";
import { projectRouter } from "./routers/project.router";
import { reviewRouter } from "./routers/review.router";
import { shareRouter } from "./routers/share.router";
import { taskRouter } from "./routers/task.router";
import { userRouter } from "./routers/user.router";
import { workspaceRouter } from "./routers/workspace.router";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  user: userRouter,
  workspace: workspaceRouter,
  project: projectRouter,
  feature: featureRouter,
  prd: prdRouter,
  task: taskRouter,
  github: githubRouter,
  review: reviewRouter,
  notification: notificationRouter,
  billing: billingRouter,
  changelog: changelogRouter,
  admin: adminRouter,
  share: shareRouter,
});

export type AppRouter = typeof appRouter;
