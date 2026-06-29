import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

let app: App<{ Octokit: typeof Octokit }> | undefined;

/** Singleton GitHub App instance, used for all GitHub API access across Alfred. */
export function getGithubApp(): App<{ Octokit: typeof Octokit }> {
  if (!app) {
    app = new App({
      appId: requiredEnv("GITHUB_APP_ID"),
      privateKey: requiredEnv("GITHUB_APP_PRIVATE_KEY"),
      oauth: {
        clientId: requiredEnv("GITHUB_APP_CLIENT_ID"),
        clientSecret: requiredEnv("GITHUB_APP_CLIENT_SECRET"),
      },
      // @octokit/app's default Octokit is a bare @octokit/core client with no
      // REST endpoint methods (no `.apps.*`, no `.paginate`). Use
      // @octokit/rest's Octokit instead so installation clients actually have
      // the methods this module calls.
      Octokit,
    });
  }
  return app;
}

/** Installation-scoped Octokit client. Token is fetched and rotated automatically. */
export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  return getGithubApp().getInstallationOctokit(installationId);
}

export interface InstallationRepo {
  githubRepoId: number;
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
}

/** Lists every repository the given GitHub App installation has access to. */
export async function listInstallationRepositories(
  installationId: number,
): Promise<InstallationRepo[]> {
  const octokit = await getInstallationOctokit(installationId);
  const repos = await octokit.paginate(octokit.apps.listReposAccessibleToInstallation, {
    per_page: 100,
  });

  return repos.map((repo) => ({
    githubRepoId: repo.id,
    fullName: repo.full_name,
    owner: repo.owner.login,
    name: repo.name,
    defaultBranch: repo.default_branch,
  }));
}

/** Builds the GitHub App installation URL, round-tripping `state` through the OAuth-style flow. */
export async function getInstallationUrl(state: string): Promise<string> {
  return getGithubApp().getInstallationUrl({ state });
}

export interface GithubPullRequestDetails {
  githubPrId: number;
  number: number;
  title: string;
  body: string | null;
  author: string | null;
  headBranch: string;
  baseBranch: string;
  htmlUrl: string;
  isMerged: boolean;
  isOpen: boolean;
  diff: string;
}

/** Fetches full PR details and the raw unified diff for a single pull request. */
export async function getPullRequestWithDiff(
  installationId: number,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<GithubPullRequestDetails> {
  const octokit = await getInstallationOctokit(installationId);

  const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber });
  const { data: diff } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
    mediaType: { format: "diff" },
  });

  return {
    githubPrId: pr.id,
    number: pr.number,
    title: pr.title,
    body: pr.body,
    author: pr.user?.login ?? null,
    headBranch: pr.head.ref,
    baseBranch: pr.base.ref,
    htmlUrl: pr.html_url,
    isMerged: pr.merged === true,
    isOpen: pr.state === "open",
    diff: diff as unknown as string,
  };
}

/**
 * Creates a new PR comment, or edits an existing one if `existingCommentId`
 * is given. PR comments are posted through the issues API — GitHub treats a
 * PR's conversation thread as an issue thread.
 */
export async function upsertPullRequestComment(
  installationId: number,
  owner: string,
  repo: string,
  pullNumber: number,
  body: string,
  existingCommentId?: number | null,
): Promise<number> {
  const octokit = await getInstallationOctokit(installationId);

  if (existingCommentId) {
    const { data } = await octokit.issues.updateComment({
      owner,
      repo,
      comment_id: existingCommentId,
      body,
    });
    return data.id;
  }

  const { data } = await octokit.issues.createComment({
    owner,
    repo,
    issue_number: pullNumber,
    body,
  });
  return data.id;
}

export interface GithubUserProfile {
  username: string;
  name: string | null;
  avatarUrl: string;
}

// `GET /users/{username}` is a public endpoint and isn't in @octokit/auth-app's
// list of routes that get JWT "app" auth — calling it through getGithubApp()
// makes the auth-app hook default to (and fail on) installation auth. It needs
// no auth at all, so use a plain unauthenticated client.
const anonymousOctokit = new Octokit();

/** Looks up a public GitHub user profile. Returns null if the username doesn't exist. */
export async function lookupGithubUser(username: string): Promise<GithubUserProfile | null> {
  try {
    const { data } = await anonymousOctokit.request("GET /users/{username}", {
      username,
    });

    return {
      username: data.login,
      name: data.name ?? null,
      avatarUrl: data.avatar_url,
    };
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 404) {
      return null;
    }
    throw error;
  }
}
