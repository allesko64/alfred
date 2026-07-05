import { createHmac, timingSafeEqual } from "crypto";
import { db, repositories } from "@alfred/db";
import { eq, inArray } from "drizzle-orm";
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

// Events GitHub sends to the App's own webhook URL, signed with the App-wide
// GITHUB_WEBHOOK_SECRET. These carry no top-level `repository`, so they can't
// be verified via a per-repo secret lookup.
const APP_LEVEL_EVENTS = new Set(["installation", "installation_repositories"]);

interface WebhookPayload {
  action?: string;
  repository?: { id?: number; full_name?: string };
  pull_request?: { number?: number; head?: { sha?: string } };
  installation?: { id?: number };
  // `installation` (action=created) lists repos as `repositories`;
  // `installation_repositories` (action=added) as `repositories_added`.
  repositories?: Array<{ id?: number }>;
  repositories_added?: Array<{ id?: number }>;
}

/**
 * Keeps stored installation ids in sync when the App is (re)installed. A
 * reinstall mints a new installation id — without this, every stored id goes
 * stale and all subsequent GitHub API calls for those repos 404.
 */
async function syncInstallation(payload: WebhookPayload): Promise<void> {
  const installationId = payload.installation?.id;
  if (!installationId) return;

  if (payload.action !== "created" && payload.action !== "added") return;

  const repoIds = [...(payload.repositories ?? []), ...(payload.repositories_added ?? [])]
    .map((repo) => repo.id)
    .filter((id): id is number => typeof id === "number");

  if (repoIds.length === 0) return;

  await db
    .update(repositories)
    .set({ installationId })
    .where(inArray(repositories.githubRepoId, repoIds));
}

export async function POST(req: Request) {
  // Read the raw body once — GitHub signs the exact bytes, so the same
  // string is reused both to look up the repo (for its per-repo secret)
  // and to verify the HMAC signature.
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const eventType = req.headers.get("x-github-event");

  // Never log the full payload — it may contain sensitive data.
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    console.warn(`github webhook: rejected event=${eventType} reason=malformed-json`);
    return new Response("Invalid payload", { status: 400 });
  }

  if (eventType && APP_LEVEL_EVENTS.has(eventType)) {
    const appSecret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!appSecret || !verifySignature(rawBody, signature, appSecret)) {
      console.warn(
        `github webhook: rejected event=${eventType} reason=${appSecret ? "bad-signature" : "GITHUB_WEBHOOK_SECRET-not-set"}`,
      );
      return new Response("Invalid signature", { status: 401 });
    }

    console.log(`github webhook: event=${eventType} action=${payload.action ?? "unknown"}`);

    await syncInstallation(payload);

    return new Response("ok", { status: 200 });
  }

  const githubRepoId = payload.repository?.id;

  if (!githubRepoId) {
    console.warn(`github webhook: rejected event=${eventType} reason=no-repository-id`);
    return new Response("Not found", { status: 404 });
  }

  const [repository] = await db
    .select({ webhookSecret: repositories.webhookSecret })
    .from(repositories)
    .where(eq(repositories.githubRepoId, githubRepoId))
    .limit(1);

  if (!repository) {
    console.warn(`github webhook: rejected event=${eventType} repo=${githubRepoId} reason=unknown-repo`);
    return new Response("Not found", { status: 404 });
  }

  // Repo events arrive on two paths: the per-repo hook (signed with the
  // repo's stored secret) and the GitHub App's own webhook (signed with the
  // app-wide secret, since the App subscribes to pull_request events).
  // Accept a valid signature from either.
  const candidateSecrets = [repository.webhookSecret, process.env.GITHUB_WEBHOOK_SECRET].filter(
    (secret): secret is string => !!secret,
  );

  if (!candidateSecrets.some((secret) => verifySignature(rawBody, signature, secret))) {
    console.warn(`github webhook: rejected event=${eventType} repo=${githubRepoId} reason=bad-signature`);
    return new Response("Invalid signature", { status: 401 });
  }

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
    // Each PR event is delivered twice (per-repo hook + App webhook). A
    // deterministic event id lets Inngest collapse the copies into a single
    // run; the head sha keeps distinct pushes distinct.
    const headSha = payload.pull_request?.head?.sha ?? "none";
    await inngest.send({
      id: `pr-ingestion/${githubRepoId}/${githubPrNumber}/${action}/${headSha}`,
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
