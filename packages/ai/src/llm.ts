import OpenAI from "openai";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

let client: OpenAI | undefined;

/** Swapping models (e.g. for cheaper/faster dev runs) is just an env change via OPENAI_MODEL. */
export function getLLMClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: requiredEnv("OPENAI_API_KEY") });
  }
  return client;
}

export function getLLMModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionResult {
  content: string;
  tokensUsed: number;
}

/** Plain-text chat completion. Returns the message content and token usage. */
export async function chatComplete(
  messages: ChatMessage[],
): Promise<ChatCompletionResult> {
  const response = await getLLMClient().chat.completions.create({
    model: getLLMModel(),
    messages,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned an empty response");
  }
  return { content, tokensUsed: response.usage?.total_tokens ?? 0 };
}

export interface JSONCompletionResult<T> {
  data: T;
  tokensUsed: number;
}

/** Chat completion that strictly parses the response as JSON of shape T. Retries once with a stricter prompt if parsing fails. */
export async function chatCompleteJSON<T>(
  messages: ChatMessage[],
): Promise<JSONCompletionResult<T>> {
  const first = await chatComplete(messages);
  try {
    return {
      data: JSON.parse(stripCodeFence(first.content)) as T,
      tokensUsed: first.tokensUsed,
    };
  } catch {
    const retry = await chatComplete([
      ...messages,
      {
        role: "user",
        content:
          "Your previous response was not valid JSON. Respond with ONLY the raw JSON object — no markdown code fences, no commentary, no extra text before or after.",
      },
    ]);
    return {
      data: JSON.parse(stripCodeFence(retry.content)) as T,
      tokensUsed: first.tokensUsed + retry.tokensUsed,
    };
  }
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fenceMatch?.[1] ?? trimmed;
}
