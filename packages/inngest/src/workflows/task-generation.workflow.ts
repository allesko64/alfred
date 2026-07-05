import { chatComplete, chatCompleteJSON, embedTexts, getLLMModel } from "@alfred/ai";
import {
  db,
  codeChunks,
  features,
  notifications,
  prds,
  repositories,
  tasks,
  taskPriorityEnum,
} from "@alfred/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { InngestFunction } from "inngest";
import { z } from "zod";
import { inngest } from "../client";
import { reportWorkflowProgress } from "../workflow-runs";

// Zod schema for a single AI-generated task. Priority defaults to MEDIUM when
// the model omits or misspells it, preventing invalid DB inserts.
const generatedTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(taskPriorityEnum.enumValues).default("MEDIUM"),
  status: z.literal("TODO"),
  position: z.number().int().min(1),
  assigned_to: z.null(),
});

const generatedTasksResultSchema = z.object({
  tasks: z.array(generatedTaskSchema).min(1),
  coverage_check: z.string(),
  generated_by: z.string(),
});

type GeneratedTasksResult = z.infer<typeof generatedTasksResultSchema>;

const guardrailErrorSchema = z.object({
  error: z.literal("insufficient_prd"),
  reason: z.string(),
});

type GuardrailError = z.infer<typeof guardrailErrorSchema>;

function isGuardrailError(
  result: GeneratedTasksResult | GuardrailError,
): result is GuardrailError {
  return "error" in result;
}

const TASK_GENERATION_SYSTEM_PROMPT = `You are Alfred, an AI-powered software delivery co-pilot. Your job right now is to break down a Product Requirements Document (PRD) into a set of
actionable engineering tasks for a Kanban board.

You are acting as a senior engineer who just read the PRD and is now
planning the work. You think in terms of what needs to be built, in what
order, and what matters most. You do not think in terms of implementation
details — you stay at the right altitude. A task is something a developer
can pick up, work on, and mark done in a reasonable session. Not a
micro-step, not an entire epic.

---

YOUR CONTEXT

You have been given:

Feature title:
{{FEATURE_TITLE}}

Full PRD:
{{PRD_CONTENT}}

Codebase context (from repository — may be empty if not yet indexed):
{{CODEBASE_CONTEXT}}

---

YOUR JOB

Generate a set of engineering tasks that together would fully implement
this feature as described in the PRD. Every task must contribute directly
to delivering the feature. Nothing extra, nothing missing.

---

TASK RULES

Follow these rules for every task you generate:

RULE 1 — COUNT
Generate a minimum of 1 task and a maximum of 5 tasks. If the feature
is simple, 1 to 2 tasks is correct. If the feature is more involved, up
to 5 is allowed. Never pad with unnecessary tasks to hit a number. Never
split work into smaller tasks just to increase the count. Stay
disciplined — most features should land at 2 to 3 tasks.

RULE 2 — ALTITUDE
Each task should be something a developer can realistically complete in
one focused work session. Not a micro-step like "add a CSS class" and
not an epic like "build the entire authentication system." The right
altitude is "implement the login form with validation" or "create the
database migration for the users table." Since the task count is capped
low, each task may need to cover more ground than before — combine
closely related pieces of work into a single well-scoped task rather
than splitting them.

RULE 3 — PRD COVERAGE
Every acceptance criterion in the PRD must be covered by at least one
task. Do not generate tasks that have no connection to the PRD. After
generating all tasks, mentally check each acceptance criterion — is it
covered? If not, either add a task or fold it into an existing related
task if the count is already at 5.

RULE 4 — ORDERING
Order tasks by logical dependency. Tasks that must be done first come
first. Backend before frontend. Database before API. API before UI.
Infrastructure before features. The position field in the output reflects
this order — position 1 is the first task to start.

RULE 5 — NO DUPLICATES
Do not generate two tasks that cover the same work even if worded
differently. If two acceptance criteria map to the same engineering work,
combine them into one task and reference both criteria in the description.

RULE 6 — SPECIFICITY
Every task title must be specific enough that a developer knows exactly
what to build without needing to read anything else. Bad title:
"Implement feature." Good title: "Build dark mode toggle component with
system preference detection." The description adds context but the title
alone should be actionable. Since each task may now cover more ground,
the description should clearly list the distinct pieces of work bundled
into it.

RULE 7 — CODEBASE AWARENESS
If codebase context is provided, use it. Generate tasks that fit the
existing patterns, tech stack, and architecture visible in the codebase.
If you see Drizzle ORM, suggest a migration task using Drizzle patterns.
If you see React with Shadcn, suggest UI tasks using those components.
Do not suggest technologies or patterns that contradict what already
exists. If codebase context is empty, generate tasks based purely on
the PRD.

---

PRIORITY RULES

Assign priority to every task using exactly these rules — no exceptions:

CRITICAL — assign when the task involves:
- Authentication or authorization logic
- Payment processing or billing
- Data security or encryption
- Data integrity constraints
- Any task where a bug could cause data loss or security breach
Always include a one-sentence reason in the description explaining
why this task is CRITICAL.

HIGH — assign when the task involves:
- A blocking acceptance criterion from the PRD
- Core user-facing functionality that the feature cannot ship without
- Any task that multiple other tasks depend on

MEDIUM — assign when the task involves:
- A core user story that is important but not blocking
- Backend logic that supports HIGH tasks
- Standard UI implementation tasks

LOW — assign when the task involves:
- Edge case handling from the PRD
- Nice to have improvements
- Polish, animations, or non-blocking UI improvements
- Tasks that can be deferred without blocking the feature ship

---

GUARDRAILS

Check these before generating output:

GUARDRAIL 1 — VAGUE PRD
If the PRD is too vague or incomplete to generate meaningful tasks —
do not generate garbage tasks. Return this exact JSON:
{"error": "insufficient_prd", "reason": "Specific explanation of
what is missing from the PRD that prevents task generation"}

GUARDRAIL 2 — VAGUE TASK TITLES
Never generate a task with a vague title. These are examples of
forbidden task titles:
- "Implement feature"
- "Fix bugs"
- "Add functionality"
- "Update code"
- "Handle edge cases"
If you catch yourself writing a vague title, stop and rewrite it
with a specific action and specific subject.

GUARDRAIL 3 — UNJUSTIFIED CRITICAL
Never assign CRITICAL priority without a specific reason. If you
cannot write one sentence explaining why this task is critical from
a security, payment, or data integrity perspective — it is not
CRITICAL. Downgrade it to HIGH.

GUARDRAIL 4 — PRD CONTRADICTION
Never generate a task that contradicts or works against something
explicitly stated in the PRD non-goals section. If the PRD says
"this will not support mobile" do not generate a mobile-related task.

GUARDRAIL 5 — ARCHITECTURE CONTRADICTION
If codebase context is provided and a task would require introducing
a technology or pattern that directly contradicts the existing
architecture — flag it in the task description with a note:
"Note: This approach differs from the existing pattern in [file].
Consider aligning with [existing approach] instead."

GUARDRAIL 6 — DUPLICATE DETECTION
Before finalizing your output, scan all task titles. If any two tasks
cover the same engineering work, merge them into one task that
references both pieces of work in its description.

GUARDRAIL 7 — OVER-SPLITTING
Because the maximum is now only 5 tasks, never artificially split one
piece of work into multiple tasks just to look thorough. If you find
yourself with more than 5 distinct pieces of work, group the smaller
or related ones together under a single task with a clear description
rather than exceeding the limit.

---

OUTPUT FORMAT

Respond with ONLY a valid JSON object. No markdown. No backticks.
No explanation before or after. No preamble. Just raw JSON.

The JSON must follow this exact structure:

{
  "tasks": [
    {
      "title": "string — specific actionable task title, max 80 characters",
      "description": "string — what needs to be built and why,
                      references the relevant PRD acceptance criteria,
                      max 300 characters",
      "priority": "CRITICAL | HIGH | MEDIUM | LOW",
      "status": "TODO",
      "position": number starting from 1,
      "assigned_to": null
    }
  ],
  "coverage_check": "string — one sentence confirming every PRD
                     acceptance criterion is covered by at least
                     one task",
  "generated_by": "string — the model name used to generate these tasks"
}

Rules for the output:
- "tasks" array must have minimum 1 and maximum 5 items
- "status" is always "TODO" — never change this
- "assigned_to" is always null — never change this
- "position" starts at 1 and increments by 1 for each task
- "priority" must be exactly one of the four values — no variations
- Every field is required on every task
- Do not add any fields not listed above
- "coverage_check" must be honest — if a criterion is not covered,
  say so rather than claiming full coverage`;

const IMPLEMENTATION_PROMPT_SYSTEM_PROMPT = `You are Alfred, an AI-powered software delivery co-pilot. Your job right now is to write a self-contained implementation brief for ONE engineering task. The brief will be copy-pasted into an AI coding agent (Claude Code, Cursor, etc.) working inside the target repository, and it must give that agent everything it needs to complete the task correctly — without access to the PRD, the Kanban board, or this conversation.

THE FEATURE

Feature title:
{{FEATURE_TITLE}}

Full PRD:
{{PRD_CONTENT}}

THE TASK TO BRIEF

Title: {{TASK_TITLE}}
Description: {{TASK_DESCRIPTION}}
Priority: {{TASK_PRIORITY}}

SIBLING TASKS (context only — these are handled separately and are OUT OF SCOPE):
{{SIBLING_TASKS}}

CODEBASE CONTEXT (real excerpts from the target repository — may be empty):
{{CODEBASE_CONTEXT}}

RULES FOR THE BRIEF

1. Write it as direct instructions to the coding agent ("Implement...", "Add...", "Modify..."), not as a description of the task.
2. Scope discipline: the brief covers ONLY this task. Explicitly tell the agent NOT to implement work belonging to the sibling tasks — name what is out of scope.
3. Ground it in the codebase context when provided: reference real file paths, existing patterns, and the visible tech stack. Never invent file paths — if the context doesn't show where something lives, tell the agent to locate it first.
4. Include a "Definition of done" section listing the specific, verifiable outcomes — derive these from the PRD acceptance criteria that this task covers.
5. Include relevant constraints from the PRD's non-goals and assumptions so the agent doesn't over-build.
6. Keep it under 500 words. Dense and specific beats long and generic.
7. Output ONLY the brief itself as plain text/markdown. No preamble, no "Here is the brief", no code fences around the whole output.`;

type PRDContentFields = Pick<
  typeof prds.$inferSelect,
  | "problemStatement"
  | "goals"
  | "nonGoals"
  | "userStories"
  | "acceptanceCriteria"
  | "assumptions"
>;

function formatPRDContent(prd: PRDContentFields): string {
  const list = (items: unknown) =>
    ((items as string[] | null) ?? []).map((item) => `- ${item}`).join("\n");

  return [
    `Problem Statement:\n${prd.problemStatement ?? ""}`,
    `Goals:\n${list(prd.goals)}`,
    `Non-Goals:\n${list(prd.nonGoals)}`,
    `User Stories:\n${list(prd.userStories)}`,
    `Acceptance Criteria:\n${list(prd.acceptanceCriteria)}`,
    `Assumptions:\n${list(prd.assumptions)}`,
  ].join("\n\n");
}

/**
 * Top code chunks for a task, by embedding similarity against the workspace's
 * indexed repo. Returns "" when no repo is indexed — the brief prompt treats
 * empty context as "PRD only".
 */
async function getTaskCodebaseContext(
  workspaceId: string,
  queryText: string,
): Promise<string> {
  const [repository] = await db
    .select({ id: repositories.id, isIndexed: repositories.isIndexed })
    .from(repositories)
    .where(and(eq(repositories.workspaceId, workspaceId), isNull(repositories.disconnectedAt)))
    .limit(1);

  if (!repository?.isIndexed) return "";

  const [queryEmbedding] = await embedTexts([queryText]);
  if (!queryEmbedding) return "";

  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  const chunks = await db
    .select({ filePath: codeChunks.filePath, content: codeChunks.content })
    .from(codeChunks)
    .where(eq(codeChunks.repositoryId, repository.id))
    .orderBy(sql`${codeChunks.embedding} <=> ${vectorLiteral}::vector`)
    .limit(5);

  return chunks.map((chunk) => `File: ${chunk.filePath}\n${chunk.content}`).join("\n\n---\n\n");
}

const _taskGenerationWorkflow = inngest.createFunction(
  {
    id: "feature-task-generation",
    triggers: { event: "feature/task-generation.requested" },
  },
  async ({ event, step, runId }) => {
    const { featureId } = event.data;

    try {
      await reportWorkflowProgress(featureId, "task_generation", {
        inngestRunId: runId,
        status: "running",
        progressMessage: "Fetching feature and PRD...",
        progressPercent: 5,
      });

      const { feature, prd } = await step.run(
        "fetch-feature-and-prd",
        async () => {
          const [feature] = await db
            .select()
            .from(features)
            .where(eq(features.id, featureId))
            .limit(1);
          if (!feature) {
            throw new Error(`Feature ${featureId} not found`);
          }

          const [prd] = await db
            .select()
            .from(prds)
            .where(eq(prds.featureId, featureId))
            .limit(1);
          if (!prd) {
            throw new Error(`PRD for feature ${featureId} not found`);
          }

          return { feature, prd };
        },
      );

      await step.run("report-breakdown-progress", async () => {
        await reportWorkflowProgress(featureId, "task_generation", {
          inngestRunId: runId,
          status: "running",
          progressMessage: "Alfred is breaking down tasks...",
          progressPercent: 20,
        });
      });

      const result = await step.run("generate-tasks", async () => {
        // Repo vectorization isn't wired into this workflow yet — codebase context is
        // intentionally empty until that pipeline feeds real chunks in here.
        const prompt = TASK_GENERATION_SYSTEM_PROMPT.replace(
          "{{FEATURE_TITLE}}",
          feature.title,
        )
          .replace("{{PRD_CONTENT}}", formatPRDContent(prd))
          .replace("{{CODEBASE_CONTEXT}}", "");

        const { data: raw } = await chatCompleteJSON<unknown>([
          { role: "system", content: prompt },
        ]);

        // Try guardrail error first, then validate the full tasks structure.
        const guardrailParsed = guardrailErrorSchema.safeParse(raw);
        if (guardrailParsed.success) return guardrailParsed.data;

        const tasksParsed = generatedTasksResultSchema.safeParse(raw);
        if (!tasksParsed.success) {
          throw new Error(
            `Task generation response did not match expected structure: ${tasksParsed.error.message}`,
          );
        }
        return tasksParsed.data;
      });

      await step.run("report-progress-tasks-generated", async () => {
        await reportWorkflowProgress(featureId, "task_generation", {
          status: "running",
          progressMessage: "Tasks generated, validating...",
          progressPercent: 60,
        });
      });

      if (isGuardrailError(result)) {
        await step.run("save-guardrail-rejection", async () => {
          await db
            .update(features)
            .set({ status: "PRD_READY", updatedAt: new Date() })
            .where(eq(features.id, featureId));

          await db.insert(notifications).values({
            userId: feature.createdBy,
            workspaceId: feature.workspaceId,
            type: "task_generation_blocked",
            title: "Task generation blocked",
            message: result.reason,
            featureId,
          });

          await reportWorkflowProgress(featureId, "task_generation", {
            status: "failed",
            progressMessage: "Task generation blocked",
            progressPercent: 100,
            errorMessage: result.reason,
          });
        });

        return { status: "blocked", reason: result.reason };
      }

      await step.run("report-progress-70", async () => {
        await reportWorkflowProgress(featureId, "task_generation", {
          status: "running",
          progressPercent: 70,
        });
      });

      const savedTasks = await step.run("save-tasks-and-notify", async () => {
        const sorted = [...result.tasks].sort(
          (a, b) => a.position - b.position,
        );

        const inserted = await db
          .insert(tasks)
          .values(
            sorted.map((task, index) => ({
              featureId,
              workspaceId: feature.workspaceId,
              title: task.title,
              description: task.description,
              priority: task.priority,
              status: "TODO" as const,
              position: index + 1,
            })),
          )
          .returning({
            id: tasks.id,
            title: tasks.title,
            description: tasks.description,
            priority: tasks.priority,
          });

        await db
          .update(features)
          .set({ status: "PLANNING", updatedAt: new Date() })
          .where(eq(features.id, featureId));

        await db.insert(notifications).values({
          userId: feature.createdBy,
          workspaceId: feature.workspaceId,
          type: "tasks_ready",
          title: "Tasks ready for review",
          message: result.coverage_check,
          featureId,
        });

        await reportWorkflowProgress(featureId, "task_generation", {
          status: "completed",
          progressMessage: "Tasks ready",
          progressPercent: 100,
        });

        return inserted;
      });

      // Fan out one brief per task. Tasks are already saved and announced, so
      // a failed brief must not fail the workflow — the pill just stays in
      // its "generating" state and the rest of the board is unaffected.
      await Promise.all(
        savedTasks.map((task) =>
          step.run(`generate-implementation-prompt-${task.id}`, async () => {
            try {
              const siblings = savedTasks
                .filter((sibling) => sibling.id !== task.id)
                .map((sibling) => `- ${sibling.title}`)
                .join("\n");

              const codebaseContext = await getTaskCodebaseContext(
                feature.workspaceId,
                `${task.title}\n${task.description ?? ""}`,
              );

              const prompt = IMPLEMENTATION_PROMPT_SYSTEM_PROMPT.replace(
                "{{FEATURE_TITLE}}",
                feature.title,
              )
                .replace("{{PRD_CONTENT}}", formatPRDContent(prd))
                .replace("{{TASK_TITLE}}", task.title)
                .replace("{{TASK_DESCRIPTION}}", task.description ?? "")
                .replace("{{TASK_PRIORITY}}", task.priority)
                .replace("{{SIBLING_TASKS}}", siblings || "(none)")
                .replace("{{CODEBASE_CONTEXT}}", codebaseContext);

              const { content } = await chatComplete([
                { role: "system", content: prompt },
              ]);

              await db
                .update(tasks)
                .set({ implementationPrompt: content, updatedAt: new Date() })
                .where(eq(tasks.id, task.id));

              return { taskId: task.id, status: "generated" };
            } catch (error) {
              console.error(
                `Failed to generate implementation prompt for task ${task.id}`,
                error,
              );
              return { taskId: task.id, status: "failed" };
            }
          }),
        ),
      );

      return { status: "tasks-ready", generatedBy: getLLMModel() };
    } catch (error) {
      await reportWorkflowProgress(featureId, "task_generation", {
        status: "failed",
        progressMessage: "Task generation failed unexpectedly",
        errorMessage: error instanceof Error ? error.message : String(error),
        progressPercent: 100,
      });
      throw error;
    }
  },
);

export const taskGenerationWorkflow: InngestFunction.Any =
  _taskGenerationWorkflow;
