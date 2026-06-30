import { db, PLAN_CREDITS, workspaces } from "@alfred/db";
import { eq } from "drizzle-orm";
import type { InngestFunction } from "inngest";
import { inngest } from "../client";

/** Resets every workspace's AI credit balance to its plan's monthly allowance, on the 1st of each month. */
const _monthlyCreditResetWorkflow = inngest.createFunction(
  { id: "monthly-credit-reset", triggers: [{ cron: "0 0 1 * *" }] },
  async ({ step }) => {
    const allWorkspaces = await step.run("fetch-workspaces", async () =>
      db.select({ id: workspaces.id, plan: workspaces.plan }).from(workspaces),
    );

    await step.run("reset-credits", async () => {
      const now = new Date();
      await Promise.all(
        allWorkspaces.map((workspace) =>
          db
            .update(workspaces)
            .set({ creditsRemaining: PLAN_CREDITS[workspace.plan], creditsResetAt: now })
            .where(eq(workspaces.id, workspace.id)),
        ),
      );
    });

    return { reset: allWorkspaces.length };
  },
);

export const monthlyCreditResetWorkflow: InngestFunction.Any = _monthlyCreditResetWorkflow;
