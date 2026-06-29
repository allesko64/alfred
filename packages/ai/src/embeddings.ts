import OpenAI from "openai";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

let client: OpenAI | undefined;

function getEmbeddingsClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: requiredEnv("OPENAI_API_KEY") });
  }
  return client;
}

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Embeds a batch of texts with the same model used for codebase
 * vectorization, so diff-chunk embeddings and code-chunk embeddings live in
 * the same vector space and can be compared directly.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const response = await getEmbeddingsClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });

  return response.data.map((item) => item.embedding);
}

/** Rough chars-per-token ratio used to size chunks without a real tokenizer. */
const CHARS_PER_CHUNK = 500 * 4;

/** Splits file content into ~500-token chunks, breaking on line boundaries so chunks stay readable. */
export function chunkContent(content: string): string[] {
  const lines = content.split("\n");
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    if (current.length + line.length + 1 > CHARS_PER_CHUNK && current.length > 0) {
      chunks.push(current);
      current = line;
    } else {
      current = current.length === 0 ? line : `${current}\n${line}`;
    }
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
