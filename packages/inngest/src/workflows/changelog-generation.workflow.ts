import { chatCompleteJSON } from "@alfred/ai";
import {
  changelog,
  db,
  features,
  notifications,
  prds,
  tasks,
} from "@alfred/db";
import { desc, eq } from "drizzle-orm";
import type { InngestFunction } from "inngest";
import { inngest } from "../client";
import { reportWorkflowProgress } from "../workflow-runs";

const CHANGELOG_PROMPT = `You are Alfred, an AI software delivery co-pilot. A feature just shipped
and you need to write its changelog entry for end users — not developers.

Feature title:
{{FEATURE_TITLE}}

PRD problem statement:
{{PROBLEM_STATEMENT}}

Tasks completed:
{{TASKS}}

Write one clean paragraph (1-3 sentences) describing what shipped, in
plain language a non-technical user would understand. Then classify
the change.

Respond with ONLY a valid JSON object, no markdown, no commentary:

{
  "type": "feature | fix | improvement",
  "entry": "string"
}`;

// changelogTypeEnum values — kept local since this is an AI output shape, not a DB type.
interface ChangelogOut {
  type: "feature" | "fix" | "improvement";
  entry: string;
}

/** Parses "v1.2.3" and bumps minor (feature/improvement) or patch (fix). Starts at v1.0.0 if the workspace has no prior entry. */
function nextVersion(
  previousVersion: string | undefined,
  type: ChangelogOut["type"],
): string {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(previousVersion ?? "");
  if (!match) return "v1.0.0";

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  return type === "fix"
    ? `v${major}.${minor}.${patch + 1}`
    : `v${major}.${minor + 1}.0`;
}

const _changelogGenerationWorkflow = inngest.createFunction(
  {
    id: "feature-changelog-generation",
    triggers: { event: "feature/changelog-generation.requested" },
  },
  async ({ event, step }) => {
    const { featureId } = event.data;

    const context = await step.run("fetch-context", async () => {
      // A feature gets exactly one changelog entry — skip duplicate events
      // (double approve, redundant sends) instead of inserting again.
      const [existingEntry] = await db
        .select({ id: changelog.id })
        .from(changelog)
        .where(eq(changelog.featureId, featureId))
        .limit(1);
      if (existingEntry) return { alreadyGenerated: true as const };

      const [feature] = await db
        .select()
        .from(features)
        .where(eq(features.id, featureId))
        .limit(1);
      if (!feature) return null;

      const [prd] = await db
        .select()
        .from(prds)
        .where(eq(prds.featureId, featureId))
        .limit(1);
      const taskRows = await db
        .select()
        .from(tasks)
        .where(eq(tasks.featureId, featureId));

      const [previousEntry] = await db
        .select({ version: changelog.version })
        .from(changelog)
        .where(eq(changelog.workspaceId, feature.workspaceId))
        .orderBy(desc(changelog.createdAt))
        .limit(1);

      return {
        feature,
        prd,
        taskRows,
        previousVersion: previousEntry?.version,
      };
    });

    if (!context) {
      return { status: "skipped", reason: "feature-not-found" };
    }

    if ("alreadyGenerated" in context) {
      return { status: "skipped", reason: "changelog-already-exists" };
    }

    const { feature, prd, taskRows, previousVersion } = context;

    await step.run("report-progress-running", async () => {
      await reportWorkflowProgress(featureId, "changelog_generation", {
        status: "running",
        progressMessage: "Alfred is writing the changelog entry...",
        progressPercent: 30,
      });
    });

    const generated = await step.run("generate-changelog-entry", async () => {
      const prompt = CHANGELOG_PROMPT.replace(
        "{{FEATURE_TITLE}}",
        feature.title,
      )
        .replace(
          "{{PROBLEM_STATEMENT}}",
          prd?.problemStatement ?? "Not specified",
        )
        .replace(
          "{{TASKS}}",
          taskRows.map((t) => `- ${t.title}`).join("\n") || "No tasks recorded",
        );

      const { data } = await chatCompleteJSON<ChangelogOut>([
        { role: "system", content: prompt },
      ]);
      return data;
    });

    const version = nextVersion(previousVersion, generated.type);

    const saved = await step.run("save-and-notify", async () => {
      // Re-check inside the step (not the memoized fetch-context) so an
      // Inngest retry of this step after a partial failure can't insert the
      // entry a second time.
      const [existingEntry] = await db
        .select({ id: changelog.id })
        .from(changelog)
        .where(eq(changelog.featureId, featureId))
        .limit(1);
      if (existingEntry) return { inserted: false };

      await db.insert(changelog).values({
        workspaceId: feature.workspaceId,
        featureId,
        version,
        entry: generated.entry,
        type: generated.type,
      });

      await db.insert(notifications).values({
        userId: feature.createdBy,
        workspaceId: feature.workspaceId,
        type: "changelog_updated",
        title: `Changelog updated — ${version}`,
        message: generated.entry,
        featureId,
      });

      await reportWorkflowProgress(featureId, "changelog_generation", {
        status: "completed",
        progressMessage: "Changelog updated",
        progressPercent: 100,
      });

      return { inserted: true };
    });

    if (!saved.inserted) {
      return { status: "skipped", reason: "changelog-already-exists" };
    }

    return { status: "generated", version };
  },
);

export const changelogGenerationWorkflow: InngestFunction.Any =
  _changelogGenerationWorkflow;
