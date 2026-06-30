import { createHmac, timingSafeEqual } from "crypto";
import { db, repositories } from "@alfred/db";
import { eq } from "drizzle-orm";
import { inngest } from "@alfred/inngest";

const HANDLED_ACTIONS = new Set(["opened", "synchronize", "closed"]);

function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;

  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function POST(req: Request) {
  // Read the raw body once — GitHub signs the exact bytes, so the same
  // string is reused both to look up the repo (for its per-repo secret)
  // and to verify the HMAC signature.
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  // Never log the full payload — it may contain sensitive data.
  const payload = JSON.parse(rawBody) as {
    action?: string;
    repository?: { id?: number; full_name?: string };
    pull_request?: { number?: number };
  };

  const githubRepoId = payload.repository?.id;

  if (!githubRepoId) {
    return new Response("Not found", { status: 404 });
  }

  const [repository] = await db
    .select({ webhookSecret: repositories.webhookSecret })
    .from(repositories)
    .where(eq(repositories.githubRepoId, githubRepoId))
    .limit(1);

  if (!repository?.webhookSecret) {
    return new Response("Not found", { status: 404 });
  }

  if (!verifySignature(rawBody, signature, repository.webhookSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const eventType = req.headers.get("x-github-event");

  console.log(`github webhook: event=${eventType} repo=${payload.repository?.full_name ?? "unknown"}`);

  if (eventType !== "pull_request") {
    return new Response("ok", { status: 200 });
  }

  const action = payload.action;
  const githubPrNumber = payload.pull_request?.number;

  if (!action || !HANDLED_ACTIONS.has(action) || !githubRepoId || !githubPrNumber) {
    return new Response("ok", { status: 200 });
  }

  try {
    await inngest.send({
      name: "github/pr-ingestion.requested",
      data: {
        githubRepoId,
        githubPrNumber,
        action: action as "opened" | "synchronize" | "closed",
      },
    });
  } catch (error) {
    console.error("Failed to fire github/pr-ingestion.requested", error);
  }

  return new Response("ok", { status: 200 });
}
