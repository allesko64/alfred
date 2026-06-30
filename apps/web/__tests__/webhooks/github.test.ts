import { createHmac, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db, projects, queryClient, repositories, users, workspaces } from "@alfred/db";

const { inngestSend } = vi.hoisted(() => ({ inngestSend: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@alfred/inngest", () => ({ inngest: { send: inngestSend } }));

const SECRET = "test-webhook-secret";
// Unique per test run (githubRepoId is unique in the DB) so reruns against a
// persistent test DB don't collide with leftover rows from a prior run.
const GITHUB_REPO_ID = Date.now();

function sign(body: string, secret = SECRET) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function request(body: string, opts: { signature?: string | null; event?: string } = {}) {
  const headers = new Headers();
  if (opts.signature !== null) headers.set("x-hub-signature-256", opts.signature ?? sign(body));
  if (opts.event) headers.set("x-github-event", opts.event);

  return new Request("http://localhost/api/webhooks/github", { method: "POST", body, headers });
}

const pullRequestPayload = (action: string) =>
  JSON.stringify({
    action,
    repository: { id: GITHUB_REPO_ID, full_name: "acme/repo" },
    pull_request: { number: 7 },
  });

describe("github webhook — signature verification (never trust an unverified payload)", () => {
  let POST: typeof import("../../app/api/webhooks/github/route").POST;

  beforeAll(async () => {
    // The webhook secret is per-repo (looked up via `repository.id` from the
    // payload), not a global env var — seed a repository row with one.
    const [user] = await db
      .insert(users)
      .values({ email: `${randomUUID()}@test.alfred.dev`, name: "Test User" })
      .returning();
    if (!user) throw new Error("Failed to create test user");

    const [workspace] = await db
      .insert(workspaces)
      .values({ name: "Test Workspace", slug: `test-ws-${randomUUID()}`, ownerId: user.id })
      .returning();
    if (!workspace) throw new Error("Failed to create test workspace");

    const [project] = await db
      .insert(projects)
      .values({ workspaceId: workspace.id, name: "Test Project", createdBy: user.id })
      .returning();
    if (!project) throw new Error("Failed to create test project");

    await db.insert(repositories).values({
      projectId: project.id,
      workspaceId: workspace.id,
      githubRepoId: GITHUB_REPO_ID,
      fullName: "acme/repo",
      installationId: 1,
      webhookSecret: SECRET,
    });

    ({ POST } = await import("../../app/api/webhooks/github/route"));
  });

  afterAll(async () => {
    await queryClient.end();
  });

  afterEach(() => {
    inngestSend.mockClear();
  });

  it("accepts a valid signature and payload, returns 200, and fires PR ingestion", async () => {
    const body = pullRequestPayload("opened");
    const res = await POST(request(body, { event: "pull_request" }));

    expect(res.status).toBe(200);
    expect(inngestSend).toHaveBeenCalledWith({
      name: "github/pr-ingestion.requested",
      data: { githubRepoId: GITHUB_REPO_ID, githubPrNumber: 7, action: "opened" },
    });
  });

  it("rejects an invalid signature with 401 and never fires the workflow", async () => {
    const body = pullRequestPayload("opened");
    const res = await POST(request(body, { signature: sign(body, "wrong-secret"), event: "pull_request" }));

    expect(res.status).toBe(401);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("rejects a missing signature header with 401", async () => {
    const body = pullRequestPayload("opened");
    const res = await POST(request(body, { signature: null, event: "pull_request" }));

    expect(res.status).toBe(401);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("fires PR ingestion for pull_request.synchronize (re-review trigger)", async () => {
    const body = pullRequestPayload("synchronize");
    const res = await POST(request(body, { event: "pull_request" }));

    expect(res.status).toBe(200);
    expect(inngestSend).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "synchronize" }) }),
    );
  });

  it("ignores an unknown/unhandled event type gracefully with 200", async () => {
    const body = JSON.stringify({
      zen: "Keep it logically awesome.",
      repository: { id: GITHUB_REPO_ID, full_name: "acme/repo" },
    });
    const res = await POST(request(body, { event: "ping" }));

    expect(res.status).toBe(200);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("returns 200 for a pull_request action it doesn't handle (e.g. labeled) without firing anything", async () => {
    const body = pullRequestPayload("labeled");
    const res = await POST(request(body, { event: "pull_request" }));

    expect(res.status).toBe(200);
    expect(inngestSend).not.toHaveBeenCalled();
  });
});
