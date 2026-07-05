import { createHmac, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db, projects, queryClient, repositories, users, workspaces } from "@alfred/db";
import { eq } from "drizzle-orm";

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
    pull_request: { number: 7, head: { sha: "abc123" } },
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
      id: `pr-ingestion/${GITHUB_REPO_ID}/7/opened/abc123`,
      name: "github/pr-ingestion.requested",
      data: { githubRepoId: GITHUB_REPO_ID, githubPrNumber: 7, action: "opened" },
    });
  });

  it("sends the same event id for both delivery copies so Inngest dedupes them", async () => {
    const body = pullRequestPayload("opened");
    // Copy 1: per-repo hook, signed with the repo secret.
    await POST(request(body, { event: "pull_request" }));
    // Copy 2: App webhook, signed with the app-level secret.
    const appSignature = sign(body, process.env.GITHUB_WEBHOOK_SECRET);
    await POST(request(body, { signature: appSignature, event: "pull_request" }));

    expect(inngestSend).toHaveBeenCalledTimes(2);
    const [first, second] = inngestSend.mock.calls.map((call) => call[0].id);
    expect(first).toBe(second);
    expect(first).toBe(`pr-ingestion/${GITHUB_REPO_ID}/7/opened/abc123`);
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

  it("accepts a pull_request event signed with the app-level secret (App webhook path)", async () => {
    // The GitHub App's own webhook also delivers pull_request events, signed
    // with GITHUB_WEBHOOK_SECRET rather than the per-repo secret.
    const body = pullRequestPayload("opened");
    const signature = sign(body, process.env.GITHUB_WEBHOOK_SECRET);
    const res = await POST(request(body, { signature, event: "pull_request" }));

    expect(res.status).toBe(200);
    expect(inngestSend).toHaveBeenCalledWith(
      expect.objectContaining({ name: "github/pr-ingestion.requested" }),
    );
  });

  it("rejects malformed JSON with 400 instead of crashing", async () => {
    const body = "{not-json";
    const res = await POST(request(body, { event: "pull_request" }));

    expect(res.status).toBe(400);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("returns 404 for a repo that isn't connected (no stored secret)", async () => {
    const body = JSON.stringify({
      action: "opened",
      repository: { id: 424242424242, full_name: "acme/unknown" },
      pull_request: { number: 1 },
    });
    const res = await POST(request(body, { event: "pull_request" }));

    expect(res.status).toBe(404);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  describe("app-level events (installation, installation_repositories)", () => {
    // These carry no top-level `repository`, so they're verified against the
    // GitHub App's own secret (GITHUB_WEBHOOK_SECRET), not a per-repo one.
    const installationRepositoriesPayload = JSON.stringify({
      action: "added",
      installation: { id: 1 },
      repositories_added: [{ id: 999, full_name: "someone/new-repo" }],
      repositories_removed: [],
    });

    it("accepts a validly-signed installation_repositories event with 200", async () => {
      const body = installationRepositoriesPayload;
      const signature = sign(body, process.env.GITHUB_WEBHOOK_SECRET);
      const res = await POST(request(body, { signature, event: "installation_repositories" }));

      expect(res.status).toBe(200);
      expect(inngestSend).not.toHaveBeenCalled();
    });

    it("rejects an installation_repositories event signed with the wrong secret", async () => {
      const body = installationRepositoriesPayload;
      const res = await POST(request(body, { signature: sign(body, "wrong-secret"), event: "installation_repositories" }));

      expect(res.status).toBe(401);
    });

    it("accepts a validly-signed installation event with 200", async () => {
      const body = JSON.stringify({ action: "created", installation: { id: 1 } });
      const signature = sign(body, process.env.GITHUB_WEBHOOK_SECRET);
      const res = await POST(request(body, { signature, event: "installation" }));

      expect(res.status).toBe(200);
    });

    it("updates the stored installation id when the App is reinstalled", async () => {
      // A reinstall mints a new installation id; the stored one must follow,
      // or every later GitHub API call for this repo 404s.
      const newInstallationId = Date.now();
      const body = JSON.stringify({
        action: "created",
        installation: { id: newInstallationId },
        repositories: [{ id: GITHUB_REPO_ID, full_name: "acme/repo" }],
      });
      const signature = sign(body, process.env.GITHUB_WEBHOOK_SECRET);
      const res = await POST(request(body, { signature, event: "installation" }));

      expect(res.status).toBe(200);
      const [repo] = await db
        .select({ installationId: repositories.installationId })
        .from(repositories)
        .where(eq(repositories.githubRepoId, GITHUB_REPO_ID));
      expect(repo?.installationId).toBe(newInstallationId);
    });

    it("updates the stored installation id when repos are added to an installation", async () => {
      const newInstallationId = Date.now() + 1;
      const body = JSON.stringify({
        action: "added",
        installation: { id: newInstallationId },
        repositories_added: [{ id: GITHUB_REPO_ID, full_name: "acme/repo" }],
        repositories_removed: [],
      });
      const signature = sign(body, process.env.GITHUB_WEBHOOK_SECRET);
      const res = await POST(request(body, { signature, event: "installation_repositories" }));

      expect(res.status).toBe(200);
      const [repo] = await db
        .select({ installationId: repositories.installationId })
        .from(repositories)
        .where(eq(repositories.githubRepoId, GITHUB_REPO_ID));
      expect(repo?.installationId).toBe(newInstallationId);
    });

    it("does not touch installation ids on an unsigned installation event", async () => {
      const body = JSON.stringify({
        action: "created",
        installation: { id: 31337 },
        repositories: [{ id: GITHUB_REPO_ID }],
      });
      const res = await POST(request(body, { signature: sign(body, "wrong-secret"), event: "installation" }));

      expect(res.status).toBe(401);
      const [repo] = await db
        .select({ installationId: repositories.installationId })
        .from(repositories)
        .where(eq(repositories.githubRepoId, GITHUB_REPO_ID));
      expect(repo?.installationId).not.toBe(31337);
    });
  });
});
