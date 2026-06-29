import { db, features, workflowRuns } from "@alfred/db";
import { and, desc, eq } from "drizzle-orm";
import { publishWorkspaceEvent } from "./sse-bus";

type WorkflowType = (typeof workflowRuns.$inferInsert)["workflowType"];
type WorkflowStatus = (typeof workflowRuns.$inferInsert)["status"];

interface ProgressPatch {
  status?: WorkflowStatus;
  progressMessage?: string;
  progressPercent?: number;
  errorMessage?: string | null;
  scheduledAt?: Date | null;
}

/** Upserts the workflow_runs row for a (featureId, workflowType) pair so the UI can poll progress. */
export async function reportWorkflowProgress(
  featureId: string,
  workflowType: WorkflowType,
  patch: ProgressPatch,
): Promise<void> {
  const [existing] = await db
    .select({ id: workflowRuns.id })
    .from(workflowRuns)
    .where(
      and(
        eq(workflowRuns.featureId, featureId),
        eq(workflowRuns.workflowType, workflowType),
      ),
    )
    .orderBy(desc(workflowRuns.createdAt))
    .limit(1);

  const status = patch.status ?? "running";
  const completedAt =
    status === "completed" || status === "failed" ? new Date() : undefined;

  if (existing) {
    await db
      .update(workflowRuns)
      .set({ ...patch, status, completedAt })
      .where(eq(workflowRuns.id, existing.id));
  } else {
    await db.insert(workflowRuns).values({
      featureId,
      workflowType,
      status,
      progressMessage: patch.progressMessage,
      progressPercent: patch.progressPercent ?? 0,
      errorMessage: patch.errorMessage ?? undefined,
      scheduledAt: patch.scheduledAt ?? undefined,
      startedAt: new Date(),
      completedAt,
    });
  }

  const [feature] = await db
    .select({ workspaceId: features.workspaceId })
    .from(features)
    .where(eq(features.id, featureId))
    .limit(1);

  if (feature) {
    publishWorkspaceEvent(feature.workspaceId, {
      type: "workflow_run.updated",
      featureId,
      workflowType,
      status,
      progressMessage: patch.progressMessage,
      progressPercent: patch.progressPercent,
    });
  }
}
