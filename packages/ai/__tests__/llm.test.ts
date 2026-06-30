import { afterEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("openai", () => ({
  default: class OpenAI {
    chat = { completions: { create: createMock } };
  },
}));

import { chatComplete, chatCompleteJSON } from "../src/llm";

function chatResponse(content: string | null) {
  return { choices: [{ message: { content } }] };
}

describe("chatComplete", () => {
  afterEach(() => {
    createMock.mockReset();
  });

  it("returns the model's text content and token usage", async () => {
    createMock.mockResolvedValueOnce(chatResponse("hello"));
    const result = await chatComplete([{ role: "user", content: "hi" }]);
    expect(result).toEqual({ content: "hello", tokensUsed: 0 });
  });

  it("throws when the model returns an empty response — never silently swallowed", async () => {
    createMock.mockResolvedValueOnce(chatResponse(null));
    await expect(chatComplete([{ role: "user", content: "hi" }])).rejects.toThrow(
      "LLM returned an empty response",
    );
  });
});

describe("chatCompleteJSON — trusting an external model's output", () => {
  afterEach(() => {
    createMock.mockReset();
  });

  it("parses a clean JSON response on the first try", async () => {
    createMock.mockResolvedValueOnce(chatResponse('{"a":1}'));
    const result = await chatCompleteJSON<{ a: number }>([{ role: "user", content: "go" }]);
    expect(result).toEqual({ data: { a: 1 }, tokensUsed: 0 });
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("strips a markdown code fence before parsing", async () => {
    createMock.mockResolvedValueOnce(chatResponse('```json\n{"a":2}\n```'));
    const result = await chatCompleteJSON<{ a: number }>([{ role: "user", content: "go" }]);
    expect(result).toEqual({ data: { a: 2 }, tokensUsed: 0 });
  });

  it("retries once with a stricter prompt when the first response isn't valid JSON", async () => {
    createMock.mockResolvedValueOnce(chatResponse("Sure! Here you go: {\"a\":3}"));
    createMock.mockResolvedValueOnce(chatResponse('{"a":3}'));

    const result = await chatCompleteJSON<{ a: number }>([{ role: "user", content: "go" }]);

    expect(result).toEqual({ data: { a: 3 }, tokensUsed: 0 });
    expect(createMock).toHaveBeenCalledTimes(2);
    const retryMessages = createMock.mock.calls[1]![0].messages;
    expect(retryMessages[retryMessages.length - 1].content).toMatch(/ONLY the raw JSON/);
  });

  it("propagates the parse error if even the retry isn't valid JSON — bad AI output never silently corrupts the DB", async () => {
    createMock.mockResolvedValueOnce(chatResponse("not json at all"));
    createMock.mockResolvedValueOnce(chatResponse("still not json"));

    await expect(chatCompleteJSON([{ role: "user", content: "go" }])).rejects.toThrow();
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
