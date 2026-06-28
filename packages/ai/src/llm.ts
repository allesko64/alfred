import OpenAI from "openai";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

let client: OpenAI | undefined;

/**
 * OpenRouter exposes an OpenAI-compatible API, so the official OpenAI SDK is
 * pointed at OpenRouter's base URL instead of using a provider-specific SDK.
 * Swapping models (e.g. for cheaper/faster dev runs) is just an env change.
 */
export function getLLMClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: requiredEnv("OPENROUTER_API_KEY"),
    });
  }
  return client;
}

export function getLLMModel(): string {
  return process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4.5";
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Plain-text chat completion. */
export async function chatComplete(messages: ChatMessage[]): Promise<string> {
  const response = await getLLMClient().chat.completions.create({
    model: getLLMModel(),
    messages,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned an empty response");
  }
  return content;
}

/** Chat completion that strictly parses the response as JSON of shape T. Retries once with a stricter prompt if parsing fails. */
export async function chatCompleteJSON<T>(messages: ChatMessage[]): Promise<T> {
  const raw = await chatComplete(messages);
  try {
    return JSON.parse(stripCodeFence(raw)) as T;
  } catch {
    const retryRaw = await chatComplete([
      ...messages,
      {
        role: "user",
        content:
          "Your previous response was not valid JSON. Respond with ONLY the raw JSON object — no markdown code fences, no commentary, no extra text before or after.",
      },
    ]);
    return JSON.parse(stripCodeFence(retryRaw)) as T;
  }
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fenceMatch?.[1] ?? trimmed;
}
