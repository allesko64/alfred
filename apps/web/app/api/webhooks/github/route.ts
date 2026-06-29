import { createHmac, timingSafeEqual } from "crypto";
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
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret || !verifySignature(rawBody, signature, secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const eventType = req.headers.get("x-github-event");
  // Never log the full payload — it may contain sensitive data.
  const payload = JSON.parse(rawBody) as {
    action?: string;
    repository?: { id?: number; full_name?: string };
    pull_request?: { number?: number };
  };

  console.log(`github webhook: event=${eventType} repo=${payload.repository?.full_name ?? "unknown"}`);

  if (eventType !== "pull_request") {
    return new Response("ok", { status: 200 });
  }

  const action = payload.action;
  const githubRepoId = payload.repository?.id;
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
