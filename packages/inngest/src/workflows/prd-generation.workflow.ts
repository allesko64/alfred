import { chatCompleteJSON, getLLMModel } from "@alfred/ai";
import {
  checkAndDeductCredits,
  clarificationMessages,
  db,
  features,
  notifications,
  prds,
} from "@alfred/db";
import { asc, eq } from "drizzle-orm";
import type { InngestFunction } from "inngest";
import { z } from "zod";
import { inngest } from "../client";
import { reportWorkflowProgress } from "../workflow-runs";

const generatedPRDSchema = z.object({
  problem_statement: z.string().min(1),
  goals: z.array(z.string()).min(1),
  non_goals: z.array(z.string()).min(1),
  user_stories: z.array(z.string()).min(1),
  acceptance_criteria: z.array(z.string()).min(1),
  assumptions: z.array(z.string()),
  scope_warning: z.string().nullable(),
  generated_by: z.string(),
});

type GeneratedPRD = z.infer<typeof generatedPRDSchema>;

const guardrailErrorSchema = z.object({
  error: z.enum(["guardrail_violation", "insufficient_context"]),
  reason: z.string(),
});

type GuardrailError = z.infer<typeof guardrailErrorSchema>;

function isGuardrailError(
  result: GeneratedPRD | GuardrailError,
): result is GuardrailError {
  return "error" in result;
}

const PRD_SYSTEM_PROMPT = `You are Alfred, an AI-powered software delivery co-pilot built into a developer tool. Your job right now is to write a Product Requirements Document (PRD) for a feature based on a conversation you just had with the user.

You are not a formal document generator. You write PRDs that real product teams actually want to read — clear, conversational, specific, and actionable. Every sentence should mean something. No filler, no corporate speak, no vague language.

---

YOUR CONTEXT

You have been given:
1. A clarification conversation between you and the user
2. Codebase context from the connected repository (may be empty if not yet indexed)

Clarification conversation:
{{CLARIFICATION_MESSAGES}}

Codebase context (from repository — may be empty):
{{CODEBASE_CONTEXT}}

---

YOUR JOB

Write a complete PRD for this feature. Use everything from the clarification conversation. If codebase context is provided, reference it — don't suggest approaches that contradict the existing architecture, patterns, or tech stack you can see in the codebase.

---

TONE AND STYLE RULES

- Write like a sharp product manager, not a lawyer writing a contract
- Use "users can" not "the system shall"
- Use plain english, short sentences, active voice
- Be specific — "users can filter by date, status, and assignee" not "users can filter results"
- Every bullet point should be a complete thought that stands alone
- If something is obvious, skip it — only write what actually needs to be said

---

ASSUMPTION RULES

You will not always have complete information. When you don't, make a reasonable assumption rather than leaving gaps. Follow these rules for assumptions:

- Only assume things that are reasonable given the context of the feature and the codebase
- Never assume a business model, pricing, or legal requirement
- Never assume a specific technology unless it is already visible in the codebase context
- State every assumption clearly and specifically — "I assumed this feature is web-only since no mobile codebase was detected" not "I made some assumptions about scope"
- If an assumption significantly changes the scope of the feature, flag it prominently

---

GUARDRAILS

Before writing the PRD, check these. If any apply, handle them as instructed:

GUARDRAIL 1 — Harmful or unethical feature
If the feature request involves anything illegal, harmful to users, designed to deceive, or unethical in nature — do not write the PRD. Instead return this exact JSON:
{"error": "guardrail_violation", "reason": "Brief explanation of why this cannot be built"}

GUARDRAIL 2 — Feature is too large
If the feature described is clearly multiple distinct features bundled together — flag it. Still write the PRD for the core feature but add a "scope_warning" field explaining what should be split out into separate features.

GUARDRAIL 3 — Possible duplicate
If the codebase context suggests this feature or something very similar might already exist — flag it in the assumptions field. Do not block the PRD, just surface it clearly.

GUARDRAIL 4 — Contradicts existing architecture
If the codebase context is provided and the feature as described would require contradicting the existing tech stack or architectural patterns — flag this in the assumptions field with a specific explanation. Suggest an approach that works with the existing architecture instead.

GUARDRAIL 5 — Insufficient clarification
If after reading the full clarification conversation you genuinely do not have enough information to write a meaningful PRD — do not write a bad PRD. Return this exact JSON:
{"error": "insufficient_context", "reason": "Specific explanation of what information is still missing"}

---

PRD QUALITY RULES

Every section must follow these rules:

- Goals: each goal must be a specific outcome, not a feature description. "Users can complete onboarding in under 2 minutes" not "Add onboarding flow"
- Non goals: be honest about what this version does NOT do. This is as important as what it does
- User stories: follow this format exactly — "As a [specific user type], I want to [specific action] so that [specific outcome]"
- Acceptance criteria: each criterion must be testable. A QA engineer should be able to read it and know exactly what to check

---

OUTPUT FORMAT

You must respond with ONLY a valid JSON object. No markdown. No backticks. No explanation before or after. No preamble. Just the raw JSON.

The JSON must follow this exact structure with these exact field names:

{
  "problem_statement": "string — one to three sentences explaining the core problem this feature solves and why it matters",

  "goals": [
    "string — specific measurable outcome",
    "string — specific measurable outcome"
  ],

  "non_goals": [
    "string — what this version explicitly does not do",
    "string — what this version explicitly does not do"
  ],

  "user_stories": [
    "As a [user type], I want to [action] so that [outcome]",
    "As a [user type], I want to [action] so that [outcome]"
  ],

  "acceptance_criteria": [
    "string — specific testable criterion",
    "string — specific testable criterion"
  ],

  "assumptions": [
    "string — specific assumption made with reasoning",
    "string — specific assumption made with reasoning"
  ],

  "scope_warning": "string or null — only present if Guardrail 2 fired. Explains what should be split into separate features",

  "generated_by": "string — the model name used to generate this PRD"
}

Every field is required. Arrays must have at least two items. No field can be null except scope_warning. Do not add any fields not listed above.`;

const _prdGenerationWorkflow = inngest.createFunction(
  {
    id: "feature-prd-generation",
    triggers: { event: "feature/prd-generation.requested" },
  },
  async ({ event, step, runId }) => {
    const { featureId } = event.data;

    try {
      await reportWorkflowProgress(featureId, "prd_generation", {
        inngestRunId: runId,
        status: "running",
        progressMessage: "Fetching feature and conversation history...",
        progressPercent: 5,
      });

      const { feature, messages } = await step.run(
        "fetch-feature-and-messages",
        async () => {
          const [feature] = await db
            .select()
            .from(features)
            .where(eq(features.id, featureId))
            .limit(1);
          if (!feature) {
            throw new Error(`Feature ${featureId} not found`);
          }

          const messages = await db
            .select()
            .from(clarificationMessages)
            .where(eq(clarificationMessages.featureId, featureId))
            .orderBy(asc(clarificationMessages.createdAt));

          return { feature, messages };
        },
      );

      const credits = await step.run("check-and-deduct-credits", async () =>
        checkAndDeductCredits(feature.workspaceId, "prd_generation"),
      );

      if (!credits.allowed) {
        await step.run("save-billing-block", async () => {
          await db.insert(notifications).values({
            userId: feature.createdBy,
            workspaceId: feature.workspaceId,
            type: "prd_blocked",
            title: "PRD generation blocked",
            message:
              "Out of AI credits. Upgrade or wait for your next monthly reset.",
            featureId,
          });

          await reportWorkflowProgress(featureId, "prd_generation", {
            status: "failed",
            progressMessage: "PRD generation blocked — out of AI credits",
            progressPercent: 100,
            errorMessage:
              "Out of AI credits. Upgrade or wait for your next monthly reset.",
          });
        });

        return { status: "blocked", reason: "billing_limit" };
      }

      await step.run("report-writing-progress", async () => {
        await reportWorkflowProgress(featureId, "prd_generation", {
          inngestRunId: runId,
          status: "running",
          progressMessage: "Alfred is writing your PRD...",
          progressPercent: 10,
        });
      });

      const result = await step.run("generate-prd", async () => {
        const conversation = messages
          .map(
            (m) => `${m.role === "alfred" ? "Alfred" : "User"}: ${m.content}`,
          )
          .join("\n\n");

        // Repo vectorization isn't wired into this workflow yet — codebase context is
        // intentionally empty until that pipeline feeds real chunks in here.
        const prompt = PRD_SYSTEM_PROMPT.replace(
          "{{CLARIFICATION_MESSAGES}}",
          conversation,
        ).replace("{{CODEBASE_CONTEXT}}", "");

        const { data: raw } = await chatCompleteJSON<unknown>([
          { role: "system", content: prompt },
        ]);

        // Validate against guardrail error shape first, then the full PRD schema.
        const guardrailParsed = guardrailErrorSchema.safeParse(raw);
        if (guardrailParsed.success) return guardrailParsed.data;

        const prdParsed = generatedPRDSchema.safeParse(raw);
        if (!prdParsed.success) {
          throw new Error(
            `PRD response did not match expected structure: ${prdParsed.error.message}`,
          );
        }
        return prdParsed.data;
      });

      await step.run("report-progress-prd-generated", async () => {
        await reportWorkflowProgress(featureId, "prd_generation", {
          status: "running",
          progressMessage: "PRD draft generated, validating...",
          progressPercent: 60,
        });
      });

      if (isGuardrailError(result)) {
        await step.run("save-guardrail-rejection", async () => {
          await db
            .update(features)
            .set({
              status: "REJECTED",
              rejectedAt: new Date(),
              rejectionReason: result.reason,
              updatedAt: new Date(),
            })
            .where(eq(features.id, featureId));

          await db.insert(notifications).values({
            userId: feature.createdBy,
            workspaceId: feature.workspaceId,
            type: "prd_blocked",
            title: "PRD generation blocked",
            message: result.reason,
            featureId,
          });

          await reportWorkflowProgress(featureId, "prd_generation", {
            status: "failed",
            progressMessage: "PRD generation blocked",
            progressPercent: 100,
            errorMessage: result.reason,
          });
        });

        return { status: "blocked", reason: result.reason };
      }

      await step.run("report-progress-70", async () => {
        await reportWorkflowProgress(featureId, "prd_generation", {
          status: "running",
          progressPercent: 70,
        });
      });

      await step.run("save-prd-and-notify", async () => {
        await db.insert(prds).values({
          featureId,
          problemStatement: result.problem_statement,
          goals: result.goals,
          nonGoals: result.non_goals,
          userStories: result.user_stories,
          acceptanceCriteria: result.acceptance_criteria,
          assumptions: result.assumptions,
          scopeWarning: result.scope_warning,
          generatedBy: getLLMModel(),
        });

        await db
          .update(features)
          .set({ status: "PRD_READY", updatedAt: new Date() })
          .where(eq(features.id, featureId));

        await db.insert(notifications).values({
          userId: feature.createdBy,
          workspaceId: feature.workspaceId,
          type: "prd_ready",
          title: "PRD ready",
          message: "PRD is ready for your review",
          featureId,
        });

        await reportWorkflowProgress(featureId, "prd_generation", {
          status: "completed",
          progressMessage: "PRD ready",
          progressPercent: 100,
        });
      });

      return { status: "prd-ready" };
    } catch (error) {
      // Catch unexpected errors (DB, network, unexpected LLM output) and mark the
      // workflow_runs row as failed so the UI doesn't show a stuck progress bar.
      await reportWorkflowProgress(featureId, "prd_generation", {
        status: "failed",
        progressMessage: "PRD generation failed unexpectedly",
        errorMessage: error instanceof Error ? error.message : String(error),
        progressPercent: 100,
      });
      throw error; // Re-throw so Inngest records the failure and respects retry policy.
    }
  },
);

export const prdGenerationWorkflow: InngestFunction.Any =
  _prdGenerationWorkflow;
