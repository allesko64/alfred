import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * GitHub redirects here after the App install/OAuth round-trip. Onboarding's
 * form data lives in localStorage on the client (keyed by `state`), so this
 * route can't finish workspace creation itself — it just forwards GitHub's
 * params back to the right client page, which reads localStorage and calls
 * the relevant tRPC mutation.
 *
 * Two flows share this single callback. The flow is distinguished by a
 * prefix baked directly into `state` (round-tripped verbatim by GitHub), so
 * this route can branch without any server-side lookup:
 *  - onboarding flow: bare `state` (a random UUID) → `/onboarding/workspace`
 *  - "connect another repo" flow: `state` = `add-repo:{workspaceId}:{uuid}`
 *    → `/workspace/{workspaceId}/github`
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const installationId = url.searchParams.get("installation_id");
  const setupAction = url.searchParams.get("setup_action");
  const state = url.searchParams.get("state");

  // Build absolute redirect URLs from the configured app URL rather than
  // req.url — self-hosted behind a reverse proxy, req.url can resolve to
  // the internal bind address (e.g. localhost:3001) instead of the public host.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    const loginUrl = new URL("/login", baseUrl);
    loginUrl.searchParams.set("callbackURL", `${url.pathname}${url.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const addRepoMatch = state?.match(/^add-repo:([^:]+):/);

  const target = addRepoMatch
    ? new URL(`/workspace/${addRepoMatch[1]}/github`, baseUrl)
    : new URL("/onboarding/workspace", baseUrl);

  if (installationId) target.searchParams.set("installation_id", installationId);
  if (setupAction) target.searchParams.set("setup_action", setupAction);
  if (state) target.searchParams.set("state", state);
  if (!installationId) target.searchParams.set("error", "missing_installation");

  return NextResponse.redirect(target);
}
