import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * GitHub redirects here after the App install/OAuth round-trip. The
 * onboarding form data lives in localStorage on the client (keyed by
 * `state`), so this route can't finish workspace creation itself — it just
 * forwards GitHub's params back to the onboarding page, which reads
 * localStorage and calls `github.completeWorkspaceOnboarding`.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const installationId = url.searchParams.get("installation_id");
  const setupAction = url.searchParams.get("setup_action");
  const state = url.searchParams.get("state");

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackURL", `${url.pathname}${url.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const target = new URL("/onboarding/workspace", req.url);
  if (installationId) target.searchParams.set("installation_id", installationId);
  if (setupAction) target.searchParams.set("setup_action", setupAction);
  if (state) target.searchParams.set("state", state);
  if (!installationId) target.searchParams.set("error", "missing_installation");

  return NextResponse.redirect(target);
}
