import { chatCompleteJSON } from "@alfred/ai";
import { clarificationMessages, db, features } from "@alfred/db";
import { asc, eq } from "drizzle-orm";
import type { InngestFunction } from "inngest";
import { inngest } from "../client";
import { reportWorkflowProgress } from "../workflow-runs";

const MAX_ALFRED_QUESTIONS = 3;

const CLARIFICATION_CHECKLIST = [
  "Who are the target users",
  "What is the core functionality",
  "What does success look like",
  "Any technical constraints",
].join("\n- ");

interface ClarificationDecision {
  done: boolean;
  question?: string;
  /** 2-5 short options the user can pick from instead of typing a free-text answer. */
  options?: string[];
}

const _clarificationWorkflow = inngest.createFunction(
  {
    id: "feature-clarification",
    triggers: { event: "feature/clarification.requested" },
  },
  async ({ event, step }) => {
    const { featureId } = event.data;

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

    const alfredQuestionCount = messages.filter(
      (m) => m.role === "alfred",
    ).length;
    const hasEnoughInfo = alfredQuestionCount >= MAX_ALFRED_QUESTIONS;

    if (!hasEnoughInfo) {
      const decision = await step.run(
        "ask-claude-for-next-question",
        async () => {
          const { data } = await chatCompleteJSON<ClarificationDecision>([
            {
              role: "system",
              content: `You are Alfred, a product assistant clarifying a feature request before a PRD is written. Make sure these points are covered before you stop asking questions:\n- ${CLARIFICATION_CHECKLIST}\n\nPrefer multiple-choice questions over open-ended ones whenever the answer fits a short list of concrete choices (e.g. target audience, scope, priority level). Give 2-3 short, mutually distinct options in "options" — the UI automatically appends a 4th "write my own answer" choice, so never include that yourself. Only leave "options" empty when the answer genuinely needs free text (e.g. asking for specific numbers, names, or open descriptions).\n\nRespond with ONLY JSON: { "done": boolean, "question": string (only if done is false), "options": string[] (only if done is false and a multiple-choice question makes sense, max 3 items) }. Set "done": true once you have enough information to write a thorough PRD, or once you've already asked ${MAX_ALFRED_QUESTIONS} questions.`,
            },
            ...messages.map((m) => ({
              role: (m.role === "alfred" ? "assistant" : "user") as
                | "assistant"
                | "user",
              content: m.content,
            })),
          ]);
          return data;
        },
      );

      if (!decision.done && decision.question) {
        await step.run("save-alfred-question", async () => {
          await db.insert(clarificationMessages).values({
            featureId,
            role: "alfred",
            content: decision.question!,
            options:
              decision.options && decision.options.length > 0
                ? decision.options
                : undefined,
          });
          await db
            .update(features)
            .set({ status: "CLARIFYING", updatedAt: new Date() })
            .where(eq(features.id, featureId));
          await reportWorkflowProgress(featureId, "clarification", {
            status: "running",
            progressMessage: "Alfred is thinking...",
            progressPercent: Math.min(90, 20 + alfredQuestionCount * 20),
          });
        });

        return { status: "awaiting-reply" };
      }
    }

    const title = await step.run("generate-title", async () => {
      const firstMessage = messages[0]?.content ?? feature.originalRequest;
      const { data: result } = await chatCompleteJSON<{ title: string }>([
        {
          role: "system",
          content:
            'Generate a short feature title, 5 words max, no punctuation at the end. Respond with ONLY JSON: { "title": string }.',
        },
        { role: "user", content: firstMessage },
      ]);
      return result.title.trim();
    });

    await step.run("update-feature-title-and-status", async () => {
      await db
        .update(features)
        .set({ title, status: "PRD_GENERATION", updatedAt: new Date() })
        .where(eq(features.id, featureId));

      await reportWorkflowProgress(featureId, "clarification", {
        status: "completed",
        progressMessage: "Generating your PRD...",
        progressPercent: 100,
      });
    });

    await step.sendEvent("fire-prd-generation", {
      name: "feature/prd-generation.requested",
      data: { featureId },
    });

    return { status: "prd-generation-requested" };
  },
);

export const clarificationWorkflow: InngestFunction.Any =
  _clarificationWorkflow;
