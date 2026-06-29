# Alfred — Complete Build Roadmap
> Build it yourself, step by step. Test each subtask before moving to the next.
> Every section has a ✅ checkbox. Check it off when done and tested.

---

## How to Use This Roadmap

- Follow phases **in order** — each phase depends on the previous
- Every subtask has a **Test** step — do not skip it
- When stuck, ask for the code for that specific subtask only
- Mark tasks `✅` as you complete them

---

## Phase 0 — Project Setup & Monorepo Foundation
> Goal: Empty repo → working monorepo with all packages scaffolded

### 0.1 — Initialize the Monorepo
- [ ] Create a new GitHub repository named `alfred`
- [ ] Clone it locally
- [ ] Initialize `package.json` at root with workspaces config
- [ ] Install and configure Turborepo at the root
- [ ] Create the `apps/` and `packages/` directories
- [ ] Add `.gitignore` at root (node_modules, .env, dist, .turbo)
- [ ] Add `turbo.json` with build/dev/lint pipeline config

**Test:** Run `turbo --version` from root. Confirm no errors.

---

### 0.2 — Create the Next.js App
- [ ] Scaffold `apps/web` using Next.js 14 with App Router
- [ ] Configure TypeScript in `apps/web`
- [ ] Install and configure Tailwind CSS
- [ ] Install and configure Shadcn UI
- [ ] Add `apps/web` to Turborepo pipeline
- [ ] Confirm `apps/web` runs on `localhost:3000`

**Test:** `turbo dev` from root → Next.js app opens in browser.

---

### 0.3 — Create the Shared Packages
- [ ] Create `packages/db` — empty package with `package.json`
- [ ] Create `packages/trpc` — empty package with `package.json`
- [ ] Create `packages/validators` — empty package with `package.json`
- [ ] Create `packages/ai` — empty package with `package.json`
- [ ] Create `packages/inngest` — empty package with `package.json`
- [ ] Add all packages to root workspace config
- [ ] Configure TypeScript `tsconfig.json` in each package
- [ ] Add each package as a dependency in `apps/web/package.json`

**Test:** Import a dummy export from each package into `apps/web`. Confirm TypeScript resolves all imports with zero errors.

---

### 0.4 — Environment Setup
- [ ] Create `.env.example` at root listing all required variables
- [ ] Create `.env.local` in `apps/web` with actual values
- [ ] Add these variables for now:
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `GITHUB_APP_ID`
  - `GITHUB_APP_PRIVATE_KEY`
  - `GITHUB_APP_WEBHOOK_SECRET`
  - `ANTHROPIC_API_KEY`
  - `OPENAI_API_KEY`
  - `UPSTASH_REDIS_URL`
  - `UPSTASH_REDIS_TOKEN`
  - `INNGEST_EVENT_KEY`
  - `INNGEST_SIGNING_KEY`
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
  - `WEBHOOK_SECRET`
  - `RESEND_API_KEY`

**Test:** All env vars load correctly. No undefined errors on startup.

---

<!-- ## Phase 1 — Database Schema & Migrations -->
> Goal: Complete PostgreSQL schema with all tables, indexes, and constraints

### 1.1 — Setup Drizzle + PostgreSQL
- [ ] Create a PostgreSQL database (Neon.tech recommended — free, serverless, Vercel-compatible)
- [ ] Install Drizzle ORM and Drizzle Kit in `packages/db`
- [ ] Configure `drizzle.config.ts` pointing to your database
- [ ] Create the Drizzle client instance
- [ ] Export client from `packages/db/index.ts`
- [ ] Import and test db client in `apps/web`

**Test:** Run `drizzle-kit studio` → database browser opens with empty DB.

---

### 1.2 — Core Tables: Users & Auth
- [ ] Create `users` table:
  - `id` (uuid, PK)
  - `email` (text, unique, not null)
  - `name` (text)
  - `avatar_url` (text)
  - `github_username` (text, unique)
  - `github_access_token` (text)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)
- [ ] Create `sessions` table (for BetterAuth)
- [ ] Create `accounts` table (for OAuth providers)
- [ ] Create `verification_tokens` table
- [ ] Run migration
- [ ] Verify all tables created in DB

**Test:** Open Drizzle Studio → confirm all 4 tables exist with correct columns.

---

### 1.3 — Workspace & Membership Tables
- [ ] Create `workspaces` table:
  - `id` (uuid, PK)
  - `name` (text, not null)
  - `slug` (text, unique, not null)
  - `owner_id` (uuid, FK → users)
  - `plan` (enum: free/pro/team)
  - `billing_status` (enum: active/past_due/cancelled)
  - `created_at` (timestamp)
- [ ] Create `workspace_memberships` table (Zanzibar tuples):
  - `id` (uuid, PK)
  - `user_id` (uuid, FK → users)
  - `workspace_id` (uuid, FK → workspaces)
  - `role` (enum: owner/admin/developer/reviewer/viewer)
  - `invited_by` (uuid, FK → users)
  - `status` (enum: active/pending)
  - `created_at` (timestamp)
- [ ] Add index on `workspace_memberships(user_id, workspace_id)`
- [ ] Add unique constraint on `(user_id, workspace_id)`
- [ ] Run migration

**Test:** Drizzle Studio → confirm tables and indexes. Try inserting a test workspace and membership row manually.

---

### 1.4 — Projects & GitHub Repositories Tables
- [ ] Create `projects` table:
  - `id` (uuid, PK)
  - `workspace_id` (uuid, FK → workspaces, cascade delete)
  - `name` (text, not null)
  - `description` (text)
  - `created_by` (uuid, FK → users)
  - `created_at` (timestamp)
- [ ] Create `repositories` table:
  - `id` (uuid, PK)
  - `project_id` (uuid, FK → projects)
  - `workspace_id` (uuid, FK → workspaces)
  - `github_repo_id` (bigint, unique)
  - `full_name` (text, not null) ← "owner/repo"
  - `owner` (text)
  - `name` (text)
  - `default_branch` (text)
  - `webhook_id` (bigint) ← GitHub webhook ID (auto-registered by GitHub App)
  - `installation_id` (bigint, not null) ← GitHub App installation ID
  - `is_indexed` (boolean, default false) ← vectorization status
  - `indexed_at` (timestamp)
  - `created_at` (timestamp)
- [ ] Add indexes on `repositories(workspace_id)` and `repositories(github_repo_id)`
- [ ] Add index on `repositories(installation_id)`
- [ ] Run migration

**Test:** Drizzle Studio → confirm tables exist. Verify `installation_id` column present. Verify foreign key constraints show correctly.

---

### 1.5 — Feature Requests & Lifecycle Tables
- [ ] Create feature status enum:
  `DRAFT → CLARIFYING → PRD_GENERATION → PRD_READY → TASK_GENERATION → PLANNING → IN_DEVELOPMENT → PR_LINKED → REVIEWING → CHANGES_REQUESTED → RE_REVIEWING → REVIEW_PASSED → PENDING_APPROVAL → APPROVED → SHIPPED → REJECTED`
- [ ] Create `features` table:
  - `id` (uuid, PK)
  - `workspace_id` (uuid, FK → workspaces)
  - `project_id` (uuid, FK → projects)
  - `title` (text, not null)
  - `original_request` (text, not null) ← raw user input
  - `status` (feature_status enum, default DRAFT)
  - `created_by` (uuid, FK → users)
  - `assigned_to` (uuid, FK → users, nullable)
  - `approved_by` (uuid, FK → users, nullable)
  - `approved_at` (timestamp)
  - `shipped_at` (timestamp)
  - `rejected_at` (timestamp)
  - `rejection_reason` (text)
  - `ai_credits_used` (integer, default 0)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)
- [ ] Add indexes on `features(workspace_id)`, `features(status)`, `features(project_id)`
- [ ] Run migration

**Test:** Insert a test feature row. Verify status enum only accepts valid values.

---

### 1.6 — Clarification & PRD Tables
- [ ] Create `clarification_messages` table:
  - `id` (uuid, PK)
  - `feature_id` (uuid, FK → features, cascade delete)
  - `role` (enum: user/alfred)
  - `content` (text, not null)
  - `created_at` (timestamp)
- [ ] Create `prds` table:
  - `id` (uuid, PK)
  - `feature_id` (uuid, FK → features, unique) ← one PRD per feature
  - `problem_statement` (text)
  - `goals` (jsonb) ← array of strings
  - `non_goals` (jsonb)
  - `user_stories` (jsonb)
  - `acceptance_criteria` (jsonb)
  - `edge_cases` (jsonb)
  - `success_metrics` (jsonb)
  - `raw_content` (text) ← full markdown version
  - `version` (integer, default 1)
  - `generated_by` (text) ← model name
  - `created_at` (timestamp)
  - `updated_at` (timestamp)
- [ ] Run migration

**Test:** Drizzle Studio → verify jsonb columns accept array data correctly.

---

### 1.7 — Tasks & Kanban Tables
- [ ] Create task status enum: `TODO / IN_PROGRESS / DONE`
- [ ] Create task priority enum: `LOW / MEDIUM / HIGH / CRITICAL`
- [ ] Create `tasks` table:
  - `id` (uuid, PK)
  - `feature_id` (uuid, FK → features, cascade delete)
  - `workspace_id` (uuid, FK → workspaces)
  - `title` (text, not null)
  - `description` (text)
  - `status` (task_status enum, default TODO)
  - `priority` (task_priority enum, default MEDIUM)
  - `assigned_to` (uuid, FK → users, nullable)
  - `estimated_hours` (integer)
  - `position` (integer) ← for kanban ordering
  - `created_at` (timestamp)
  - `updated_at` (timestamp)
- [ ] Add index on `tasks(feature_id)`, `tasks(status)`
- [ ] Run migration

**Test:** Insert 3 tasks with different statuses. Query by status.

---

### 1.8 — Pull Requests & Reviews Tables
- [ ] Create pr_status enum: `OPEN / CLOSED / MERGED`
- [ ] Create review_status enum: `PENDING / IN_PROGRESS / PASSED / FAILED`
- [ ] Create issue_severity enum: `BLOCKING / NON_BLOCKING`
- [ ] Create `pull_requests` table:
  - `id` (uuid, PK)
  - `feature_id` (uuid, FK → features)
  - `repository_id` (uuid, FK → repositories)
  - `github_pr_id` (bigint, unique)
  - `github_pr_number` (integer)
  - `title` (text)
  - `body` (text)
  - `author` (text)
  - `head_branch` (text)
  - `base_branch` (text)
  - `diff_url` (text)
  - `status` (pr_status enum)
  - `merged_at` (timestamp)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)
- [ ] Create `ai_reviews` table:
  - `id` (uuid, PK)
  - `feature_id` (uuid, FK → features)
  - `pull_request_id` (uuid, FK → pull_requests)
  - `review_number` (integer) ← cycle count (1, 2, 3...)
  - `status` (review_status enum)
  - `summary` (text)
  - `blocking_count` (integer, default 0)
  - `non_blocking_count` (integer, default 0)
  - `github_comment_id` (bigint) ← posted comment ID
  - `model_used` (text)
  - `tokens_used` (integer)
  - `created_at` (timestamp)
- [ ] Create `review_issues` table:
  - `id` (uuid, PK)
  - `review_id` (uuid, FK → ai_reviews, cascade delete)
  - `title` (text, not null)
  - `description` (text)
  - `severity` (issue_severity enum)
  - `file_path` (text)
  - `line_number` (integer)
  - `prd_requirement_violated` (text) ← which PRD point it breaks
  - `suggested_fix` (text)
  - `is_resolved` (boolean, default false)
  - `resolved_at` (timestamp)
  - `created_at` (timestamp)
- [ ] Run migration

**Test:** Query review_issues with JOIN to ai_reviews. Verify cascade delete works (delete a review → issues deleted).

---

### 1.9 — Notifications, Billing & Invites Tables
- [ ] Create `notifications` table:
  - `id` (uuid, PK)
  - `user_id` (uuid, FK → users)
  - `workspace_id` (uuid, FK → workspaces)
  - `type` (text) ← "prd_ready", "review_complete", "approval_needed" etc
  - `title` (text)
  - `message` (text)
  - `is_read` (boolean, default false)
  - `feature_id` (uuid, FK → features, nullable)
  - `created_at` (timestamp)
- [ ] Create `billing_subscriptions` table:
  - `id` (uuid, PK)
  - `workspace_id` (uuid, FK → workspaces, unique)
  - `razorpay_subscription_id` (text)
  - `razorpay_customer_id` (text)
  - `plan` (enum: free/pro/team)
  - `status` (enum: active/past_due/cancelled/trialing)
  - `current_period_start` (timestamp)
  - `current_period_end` (timestamp)
  - `created_at` (timestamp)
- [ ] Create `workspace_invites` table:
  - `id` (uuid, PK)
  - `workspace_id` (uuid, FK → workspaces)
  - `invited_by` (uuid, FK → users)
  - `github_username` (text)
  - `email` (text)
  - `role` (role enum)
  - `token` (text, unique) ← invite link token
  - `status` (enum: pending/accepted/expired)
  - `expires_at` (timestamp)
  - `created_at` (timestamp)
- [ ] Run migration

**Test:** Drizzle Studio → verify all tables. Run a full schema check — all 15+ tables present.

---

### 1.10 — Vector Table (pgvector)
- [ ] Enable pgvector extension in PostgreSQL
- [ ] Create `code_chunks` table:
  - `id` (uuid, PK)
  - `repository_id` (uuid, FK → repositories)
  - `workspace_id` (uuid, FK → workspaces)
  - `file_path` (text, not null)
  - `chunk_index` (integer)
  - `content` (text, not null)
  - `embedding` (vector, dimensions: 1536)
  - `last_commit` (text)
  - `language` (text)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)
- [ ] Add ivfflat index on `embedding` column for similarity search
- [ ] Add index on `code_chunks(repository_id, file_path)`
- [ ] Run migration

**Test:** Insert a test row with a dummy embedding vector. Run a similarity search query manually. Confirm it returns results.

---

### 1.11 — Inngest Workflow State Table
- [ ] Create `workflow_runs` table:
  - `id` (uuid, PK)
  - `feature_id` (uuid, FK → features)
  - `workflow_type` (enum: prd_generation/task_generation/pr_ingestion/ai_review/re_review/release_readiness/repo_vectorization)
  - `inngest_run_id` (text) ← Inngest's own run ID
  - `status` (enum: pending/running/completed/failed)
  - `progress_message` (text) ← "Generating PRD..." shown in UI
  - `progress_percent` (integer, default 0)
  - `error_message` (text)
  - `started_at` (timestamp)
  - `completed_at` (timestamp)
  - `created_at` (timestamp)
- [ ] Run migration

**Test:** Insert a test workflow run. Update status and progress. Verify UI can poll this table for real-time progress.

---

<!-- ## Phase 2 — Authentication -->
> Goal: Full auth flow working — signup, login, OAuth, sessions

### 2.1 — Install & Configure BetterAuth
- [ ] Install BetterAuth in `apps/web`
- [ ] Create BetterAuth config with:
  - Email + password provider
  - GitHub OAuth provider
  - Google OAuth provider
- [ ] Connect BetterAuth to Drizzle adapter (PostgreSQL)
- [ ] Create the auth API route: `apps/web/app/api/auth/[...all]/route.ts`
- [ ] Export `auth` and `auth.handler` from config

**Test:** Hit `/api/auth/session` in browser → returns null (no session). No errors.

---

### 2.2 — GitHub OAuth App Setup
- [ ] Create a GitHub OAuth App in GitHub Developer Settings
- [ ] Set callback URL: `http://localhost:3000/api/auth/callback/github`
- [ ] Copy Client ID and Client Secret to `.env`
- [ ] Configure GitHub provider in BetterAuth
- [ ] Request scopes: `read:user`, `user:email`, `repo`, `admin:repo_hook`

**Test:** Click "Login with GitHub" → redirects to GitHub → authorizes → redirects back → session created. Check `users` table in DB.

---

### 2.3 — Google OAuth Setup
- [ ] Create Google OAuth credentials in Google Cloud Console
- [ ] Set callback URL: `http://localhost:3000/api/auth/callback/google`
- [ ] Copy Client ID and Client Secret to `.env`
- [ ] Configure Google provider in BetterAuth

**Test:** Click "Login with Google" → full OAuth flow → session created.

---

### 2.4 — Auth Pages (UI)
- [ ] Create `/login` page with:
  - Email + password form
  - "Continue with GitHub" button
  - "Continue with Google" button
  - Link to signup
- [ ] Create `/signup` page with:
  - Name, email, password fields
  - "Continue with GitHub" button
  - "Continue with Google" button
  - Link to login
- [ ] Create `/auth/error` page for auth errors
- [ ] Add loading states to all auth buttons
- [ ] Add form validation (client-side with Zod)

**Test:** Full signup with email → verify user in DB. Login → session cookie set. Wrong password → error shown. Logout → session cleared.

---

### 2.5 — Auth Middleware & Route Protection
- [x] Create Next.js middleware to protect all `/dashboard` and `/workspace` routes
- [x] Redirect unauthenticated users to `/login`
- [x] Redirect authenticated users away from `/login` and `/signup`
- [x] Store return URL for post-login redirect

**Test:** Visit `/dashboard` without login → redirects to `/login`. Login → redirects back to `/dashboard`.

---

<!-- ## Phase 3 — tRPC Setup & Core Middleware -->
> Goal: Type-safe API layer with auth + permission middleware

### 3.1 — tRPC Base Setup
- [x] Install tRPC in `packages/trpc`
- [x] Create tRPC context (includes: session, user, db)
- [x] Create base tRPC instance with context
- [x] Create 3 procedure types:
  - `publicProcedure` — no auth required
  - `protectedProcedure` — requires valid session
  - `workspaceProcedure` — requires session + workspace membership
- [x] Export router creator and all procedure types
- [x] Set up tRPC HTTP handler in `apps/web/app/api/trpc/[trpc]/route.ts`

**Test:** Create a dummy `hello` public procedure. Call it from the frontend. Confirm typed response.

---

### 3.2 — Permission Middleware (Zanzibar Layer)
- [x] Create permission check function in `packages/trpc`:
  - Takes: userId, workspaceId, requiredRoles[]
  - Checks L1 LRU cache first
  - Checks L2 Upstash Redis second
  - Falls back to DB query
  - Returns: role or throws FORBIDDEN
- [x] Create LRU cache instance (max 500, TTL 1 min)
- [x] Connect Upstash Redis client
- [x] Create cache invalidation function
- [x] Wire permission check into `workspaceProcedure` middleware

**Test:** Create a protected workspace route. Call it without workspace membership → FORBIDDEN error. Add membership → succeeds.

---

### 3.3 — Core Routers Setup
- [x] Create router files in `packages/trpc/routers/`:
  - `workspace.router.ts`
  - `project.router.ts`
  - `feature.router.ts`
  - `prd.router.ts`
  - `task.router.ts`
  - `github.router.ts`
  - `review.router.ts`
  - `notification.router.ts`
  - `billing.router.ts`
  - `user.router.ts`
- [x] Create root `appRouter` combining all routers
- [x] Export `AppRouter` type from `packages/trpc`
- [x] Import `AppRouter` type in `apps/web` for client

**Test:** Import `AppRouter` in the Next.js app. TypeScript should show all router namespaces with correct types. Zero type errors.

---

### 3.4 — Zod Validators Setup
- [x] Create Zod schemas in `packages/validators` for every input:
  - `createWorkspace.schema.ts`
  - `createFeature.schema.ts`
  - `createTask.schema.ts`
  - `connectGithub.schema.ts`
  - `inviteMember.schema.ts`
  - `createPRD.schema.ts`
  - etc.
- [x] Export all schemas from `packages/validators/index.ts`
- [x] Import validators in `packages/trpc` routers (NOT redefined — imported)
- [ ] Import validators in `apps/web` forms (same schema, same source) — no workspace/feature/task forms exist yet (Phase 4+); login/signup forms already use `@alfred/validators`

**Test:** Change a validator field name in `packages/validators`. Confirm TypeScript errors appear in BOTH the router AND the frontend form simultaneously.

---

<!-- ## Phase 4 — Onboarding Flow -->
> Goal: New user → workspace → GitHub connected → ready

### 4.1 — Onboarding State Tracking ✅
- [x] Add `onboarding_step` field to `workspaces` table (enum: `team`/`complete` — workspace/github steps collapsed into one page, see 4.2)
- [x] Create tRPC procedure: `workspace.getOnboardingStatus`
- [x] Create tRPC procedure: `workspace.completeOnboardingStep`
- [x] Add redirect logic: `/dashboard` checks workspace count + onboardingStep and routes accordingly

**Test:** Create a workspace → onboarding_step is "github". Complete GitHub step → onboarding_step is "team". Complete team → "complete".

---

### 4.2 — Create Workspace Step (UI) ✅
> Deviation from plan: merged with 4.3 per final decision — one page collects the
> form, then "Connect GitHub" drives the GitHub App install, and the workspace
> isn't created in the DB until that round-trip returns (avoids orphan rows).
- [x] Create `/onboarding/workspace` page
- [x] Form: workspace name + what are you building (dropdown)
- [x] On submit: call `github.completeWorkspaceOnboarding` tRPC procedure (not `workspace.create` — see deviation note)
- [x] Procedure creates workspace + adds user as owner in membership table (+ default project + repo, in one transaction)
- [x] On success: redirect to team step

**Test:** Submit form → workspace row in DB → membership row in DB with role "owner" → redirected to next step.

---

### 4.2.1 — Create GitHub App (One-Time Setup) ✅
> Do this BEFORE building the connect GitHub UI

- [ ] Go to `github.com/settings/apps → New GitHub App`
- [ ] Fill in these details:
  - **App name:** Alfred (or Alfred-Dev for local testing)
  - **Homepage URL:** `https://yourdomain.com` (or `http://localhost:3000` for dev)
  - **Callback URL:** `https://yourdomain.com/api/github/callback`
  - **Webhook URL:** `https://yourdomain.com/api/webhooks/github`
    - Use ngrok URL during local dev: `https://abc123.ngrok.io/api/webhooks/github`
  - **Webhook secret:** generate with `openssl rand -base64 32` → save as `GITHUB_APP_WEBHOOK_SECRET`
- [ ] Set these permissions:
  - Repository → Contents: **Read**
  - Repository → Pull requests: **Read & Write** ← to post review comments
  - Repository → Metadata: **Read**
  - Repository → Webhooks: **Read & Write** ← auto-registers on install
- [ ] Subscribe to these events:
  - Pull request
  - Push
- [ ] Set "Where can this GitHub App be installed?" → **Any account**
- [ ] Create the app
- [ ] After creating:
  - Copy **App ID** → save as `GITHUB_APP_ID`
  - Generate **Private Key** → download `.pem` file → save contents as `GITHUB_APP_PRIVATE_KEY`
  - Copy **Client ID** → save as `GITHUB_CLIENT_ID`
  - Generate **Client Secret** → save as `GITHUB_CLIENT_SECRET`
- [ ] Add all to `.env.local`

**Test:** GitHub App appears in `github.com/settings/apps`. All credentials saved in `.env.local`. App ID and Private Key are not empty.

---

### 4.2.2 — Setup ngrok for Local Webhook Testing — deferred
> Tried, reverted to localhost-only for now (no public tunnel needed until Phase 8 webhooks).
- [ ] Install ngrok: `npm install -g ngrok` or download from ngrok.com
- [ ] Create free ngrok account at ngrok.com
- [ ] Add your auth token: `ngrok config add-authtoken YOUR_TOKEN`
- [ ] Start ngrok tunnel:
  ```bash
  ngrok http 3000
  ```
- [ ] Copy the HTTPS URL (e.g. `https://abc123.ngrok.io`)
- [ ] Update GitHub App webhook URL in GitHub settings to use ngrok URL
- [ ] Add ngrok URL to `.env.local` as `NEXTAUTH_URL` temporarily

**Test:** Start ngrok → visit the ngrok URL in browser → Alfred app loads. GitHub App webhook URL points to ngrok URL.

---

### 4.3 — Connect GitHub Step (UI + API) ✅
> Deviation: no separate `/onboarding/github` page — "Connect GitHub" button lives
> on the workspace page (4.2) per final decision. No repo-picker screen either
> (not in the literal UI spec given) — first repo from the installation is used
> automatically; `githubRepoId` stays optional in the schema if a picker is added later.
- [x] ~~Create `/onboarding/github` page~~ — merged into `/onboarding/workspace`
- [x] "Connect GitHub" button (disabled + tooltip until workspace name filled)
- [x] Button fetches the install URL via `github.getInstallationUrl` (uses `app.getInstallationUrl()`, no hardcoded app slug needed)
- [x] Create GitHub App callback handler: `apps/web/app/api/github/callback/route.ts`
  - Receives `installation_id` + `setup_action` + `state`, forwards to the client (form data lives in localStorage, not server-side)
  - Installation token handled by `@octokit/app` per-call, not exchanged/stored
  - Repo fetched + saved via `github.completeWorkspaceOnboarding` tRPC mutation
  - Workspace ↔ installation mapping stored on the `repositories` row (`installation_id`)
  - Redirects to onboarding team step
- [x] Installed required packages: `@octokit/app @octokit/auth-app @octokit/rest`
- [x] Create Octokit App instance in `packages/ai/src/github.ts`
  - Initialized with App ID + Private Key + OAuth client id/secret
  - `Octokit` class overridden to `@octokit/rest`'s (the bare `@octokit/core` client `@octokit/app` uses by default has no `.apps`/`.paginate` methods — found and fixed this bug during testing)
  - `getInstallationOctokit()` / `listInstallationRepositories()` used for ALL installation-scoped calls
- [ ] Show installed repos / green checkmarks / "Add more repos" button — not built (no picker screen per current scope)
- [x] Fire Inngest `repo-vectorization.requested` event after connecting the repo (best-effort — wrapped in try/catch since Inngest isn't configured yet; was causing false 500s otherwise)

**Test:** Click "Connect GitHub" → GitHub install screen → select repos → redirected back to Alfred → repo appears in `repositories` table with `installation_id`. Inngest event fires (or fails silently, logged, until Phase 13).

---

### 4.4 — Invite Team Step (UI) ✅
- [x] Create `/onboarding/team` page
- [x] Input: GitHub username (email path not built — username-only per current UI spec)
- [x] On GitHub username input:
  - Call `github.lookupUser` tRPC procedure (500ms debounce)
  - Fetch profile via unauthenticated Octokit (`GET /users/{username}` — found and fixed a bug where this went through App-level auth and always 0% succeeded)
  - Show avatar card preview, fade-in
- [x] Role selector dropdown (Admin/Developer/Reviewer/Viewer)
- [x] Add to pending list (not saved yet)
- [x] On "Continue": save all invites via `workspace.inviteMember` (looped), then `workspace.completeOnboardingStep` (step: complete)
- [ ] Send invite email via Resend — not built (Phase 12/Resend not wired up yet); invites just save to DB with status "pending"
- [x] "Skip for now" button → same finalize path, marks onboarding complete

**Test:** Type a real GitHub username → profile card appears with avatar. Add them → invite row in DB with status "pending". Skip → onboarding_step = "complete".

---

<!-- ## Phase 5 — Dashboard -->
> Goal: Post-login dashboard with real data

### 5.1 — Dashboard Layout
- [ ] Create root layout for `/workspace/[workspaceId]`
- [ ] Build sidebar component with nav items:
  - Dashboard, Features, Projects, Tasks, Reviews, GitHub
  - Billing, Settings (bottom)
  - User avatar + name (bottom)
- [ ] Build top bar with:
  - Workspace switcher dropdown
  - Search input (placeholder for now)
  - Notifications bell
  - "+ New Feature" button
- [ ] Make layout responsive (sidebar collapses on mobile)

**Test:** Navigate between sidebar items → URL changes correctly → active item highlighted.

---

### 5.2 — Dashboard Stats Cards
- [ ] Create tRPC procedure: `workspace.getDashboardStats`
  - Returns: active features count, in-review count, shipped count, AI credits remaining
  - All from real DB queries
  - Enforces workspace membership check
- [ ] Build 4 stat cards UI component
- [ ] Wire to tRPC query with loading skeleton
- [ ] Show real numbers from DB

**Test:** Create 2 features manually in DB → dashboard shows count = 2. Use a credit → credits remaining decrements.

---

### 5.3 — Feature Pipeline View
- [ ] Create tRPC procedure: `feature.getStatusCounts`
  - Returns count of features per status
- [ ] Build pipeline visualization component:
  - Horizontal flow: DRAFT → PLANNING → IN DEV → IN REVIEW → APPROVAL → SHIPPED
  - Show count under each stage
  - Each stage is clickable → goes to filtered features list
- [ ] Wire to tRPC query

**Test:** Create features with different statuses → pipeline counts update correctly.

---

### 5.4 — Alfred Activity Feed
- [ ] Create tRPC procedure: `notification.getWorkspaceActivity`
  - Returns last 20 notifications for workspace
  - Ordered by created_at DESC
- [ ] Build activity feed UI component
  - Each item: icon + message + relative timestamp
  - Color coded by type
- [ ] Wire to tRPC query
- [ ] Auto-refresh every 30 seconds

**Test:** Create a notification row manually in DB → appears in feed. Timestamp shows "2 min ago" format.

---

### 5.5 — Recent Features List
- [ ] Create tRPC procedure: `feature.getRecent`
  - Returns last 5 features for workspace
  - Includes: title, status, updated_at
- [ ] Build recent features table component
- [ ] Each row clickable → goes to feature detail page
- [ ] Status badge with correct color per state

**Test:** Create 6 features → table shows exactly 5 (most recent). Status badges show correct colors.

---

### 5.6 — GitHub Activity Widget
- [ ] Create tRPC procedure: `github.getRecentPRs`
  - Queries `pull_requests` table for workspace
  - Returns last 5 PRs with status
- [ ] Build GitHub activity widget
  - Shows: PR number, title, status badge, linked feature
  - Connected repo name at top

**Test:** Insert a test PR row → appears in widget. Status "open" shows correct badge.

---

## Phase 6 — Feature Request Flow
> Goal: User submits request → Alfred clarifies → PRD generated

### 6.1 — Feature Request Submission
- [ ] Create `/workspace/[id]/features/new` page
- [ ] Simple form: title + description textarea
- [ ] Call `feature.create` tRPC procedure:
  - Validates input against Zod schema
  - Checks billing limits (free tier: max 3 features)
  - Creates feature row with status DRAFT
  - Creates first `clarification_messages` row (user's message)
  - Fires Inngest `clarification-start` event
- [ ] Redirect to feature detail page on success

**Test:** Submit form → feature row in DB with status DRAFT → clarification_messages row with role "user" → Inngest event fires.

---

### 6.1.1 — Smart Duplicate Detection (Alfred Smart Suggestions)
- [ ] Before creating a feature, call `feature.checkDuplicate` tRPC procedure:
  - Embeds the feature title + description via OpenAI
  - Queries pgvector for similar existing PRDs
  - Returns: top 3 similar features with similarity score
  - Threshold: if similarity > 80% → show warning
- [ ] Build duplicate detection UI on the new feature form:
  - After user types title + description and clicks Submit
  - Alfred checks for duplicates BEFORE creating the feature
  - If duplicate found → show warning card:
    ```
    ⚠️ Similar feature already exists:
    "Theme Customization" (SHIPPED 3 months ago)
    → May already cover this request

    💡 Related feature in progress:
    "User Preferences Panel" (IN DEVELOPMENT)
    → Could include this instead

    [ Create anyway ] [ View existing ] [ Add as subtask ]
    ```
  - If no duplicate → proceed normally
- [ ] Create tRPC procedure: `feature.addAsSubtask`
  - Links new request as a task under an existing feature
  - Creates task row instead of feature row
- [ ] Add `changelog` table to DB:
  - `id` (uuid, PK)
  - `workspace_id` (uuid, FK → workspaces)
  - `feature_id` (uuid, FK → features)
  - `version` (text) ← auto-generated e.g. "v2.4.0"
  - `entry` (text) ← Claude-generated changelog text
  - `type` (enum: feature/fix/improvement)
  - `created_at` (timestamp)

**Test:** Submit "Add night mode" → Alfred detects similarity to existing "Dark Mode" feature → warning card shows with 3 options. Click "Create anyway" → feature created normally. Click "Add as subtask" → task created under existing feature.

---

### 6.2 — Alfred Clarification Chat (Backend)
- [ ] Create Inngest workflow: `clarification`
  - Step 1: Fetch feature request from DB
  - Step 2: Call Claude via AI SDK with clarification prompt
  - Step 3: Parse response — does Alfred need more info?
  - Step 4: If yes → save Alfred's question to clarification_messages → update workflow_runs progress
  - Step 5: If no → fire `prd-generation` event → update feature status to PRD_GENERATION
- [ ] Create tRPC procedure: `feature.submitClarificationReply`
  - Saves user's reply to clarification_messages
  - Fires next clarification step in Inngest

**Test:** Submit a vague feature request → Alfred asks a clarifying question → reply → Alfred either asks again or moves to PRD generation.

---

### 6.3 — Clarification Chat UI
- [ ] Create Overview tab on feature detail page
- [ ] Build chat UI component:
  - Alfred messages on left (with Alfred avatar)
  - User messages on right
  - Input box at bottom
  - Send button
- [ ] Show workflow progress bar when Alfred is "thinking"
- [ ] Poll `workflow_runs` table every 2 seconds for progress updates
- [ ] Disable input while Alfred is processing

**Test:** Full chat flow visible in UI. Progress bar shows while Inngest runs. Alfred's response appears after workflow completes.

---

### 6.4 — PRD Generation (Backend)
- [ ] Create Inngest workflow: `prd-generation`
  - Step 1: Fetch all clarification messages for context
  - Step 2: Update workflow progress: "Alfred is writing your PRD..."
  - Step 3: Call Claude with PRD generation prompt
  - Step 4: Parse structured JSON response into PRD fields
  - Step 5: Save to `prds` table
  - Step 6: Update feature status to PRD_READY
  - Step 7: Create notification: "PRD ready for review"
  - Step 8: Update workflow progress: "Complete"

**Test:** After clarification → PRD generation triggers → `prds` table populated with all fields → feature status = PRD_READY → notification created.

---

### 6.5 — PRD Display (UI)
- [ ] Create Plan tab on feature detail page
- [ ] Fetch PRD via `prd.getByFeature` tRPC procedure
- [ ] Display PRD sections:
  - Problem Statement
  - Goals (bulleted list)
  - Non-Goals (bulleted list)
  - User Stories
  - Acceptance Criteria
  - Edge Cases
  - Success Metrics
- [ ] "Approve PRD" button → triggers task generation
- [ ] Show loading state while PRD is being generated (poll workflow_runs)

**Test:** PRD displays all sections correctly. Approve button triggers task generation workflow. Loading state shows during generation.

---

## Phase 7 — Task Generation & Kanban
> Goal: PRD → Tasks → Kanban board

### 7.1 — Task Generation (Backend)
- [ ] Create Inngest workflow: `task-generation`
  - Step 1: Fetch PRD from DB
  - Step 2: Update progress: "Alfred is breaking down tasks..."
  - Step 3: Call Claude with task generation prompt
  - Step 4: Parse structured JSON response (array of tasks)
  - Step 5: Insert all tasks to `tasks` table with position index
  - Step 6: Update feature status to PLANNING
  - Step 7: Create notification: "Tasks ready for review"

**Test:** Approve PRD → tasks appear in DB → feature status = PLANNING → notification created.

---

### 7.2 — Kanban Board (UI)
- [ ] Create Tasks tab on feature detail page
- [ ] Fetch tasks via `task.getByFeature` tRPC procedure
- [ ] Build 3-column Kanban:
  - TODO column
  - IN PROGRESS column
  - DONE column
- [ ] Each task card shows: title, description, priority badge, assignee
- [ ] Drag and drop between columns (use `@dnd-kit/core`)
- [ ] On drop: call `task.updateStatus` tRPC procedure
- [ ] "Approve Plan" button → moves feature to IN_DEVELOPMENT

**Test:** Drag task from TODO to IN PROGRESS → status updates in DB. Refresh page → task stays in new column.

---

### 7.3 — Task Management
- [ ] Click task card → opens task detail drawer
- [ ] Edit task title, description, priority
- [ ] Assign to workspace member
- [ ] Mark task as done
- [ ] All changes persist via tRPC procedures

**Test:** Edit a task title → DB updates → refresh → new title shows.

---

## Phase 8 — GitHub Integration
> Goal: Real GitHub connection, webhooks, PR tracking

### 8.1 — Webhook Handler
- [ ] Create webhook endpoint: `apps/web/app/api/webhooks/github/route.ts`
- [ ] Verify GitHub webhook signature using `GITHUB_APP_WEBHOOK_SECRET`:
  - Use HMAC-SHA256 signature verification
  - GitHub App sends `X-Hub-Signature-256` header automatically
  - Reject any request where signature doesn't match → 401
- [ ] Parse event type from `X-GitHub-Event` header
- [ ] Handle pull_request events: `opened`, `synchronize`, `closed`, `merged`
- [ ] Handle installation events: `created`, `deleted`
  - `created` → save new installation to DB
  - `deleted` → mark repos as disconnected in DB
- [ ] On valid PR event: fire Inngest `pr-ingestion` event with payload
- [ ] Return 200 immediately (async processing via Inngest)
- [ ] Use `@octokit/webhooks` for signature verification:
  ```bash
  pnpm add @octokit/webhooks
  ```

**Test:** Send a test webhook payload via GitHub App settings → endpoint receives it → signature verified using `GITHUB_APP_WEBHOOK_SECRET` → Inngest event fires. Bad signature → 401 returned. Installation deleted event → repo marked disconnected in DB.

---

### 8.2 — PR Ingestion Workflow (Inngest)
- [ ] Create Inngest workflow: `pr-ingestion`
  - Step 1: Find repository in DB by `github_repo_id`
  - Step 2: Get installation-specific Octokit client:
    - Use `installation_id` from repository row
    - `@octokit/auth-app` auto-generates + rotates token
    - Token valid for 1 hour — handled automatically
  - Step 3: Fetch full PR details via Octokit
  - Step 4: Fetch PR diff via Octokit (`GET /repos/{owner}/{repo}/pulls/{pull_number}/files`)
  - Step 5: Upsert PR to `pull_requests` table
  - Step 6: Try to auto-link to a feature (by branch name pattern: `alfred/feature-id`)
  - Step 7: If linked → update feature status to PR_LINKED → fire `ai-review` event
  - Step 8: If not linked → create notification: "New PR needs to be linked"

**Test:** Open a real PR in a connected repo → webhook fires → PR appears in `pull_requests` table → diff is fetched using installation token (not PAT) → stored correctly.

---

### 8.3 — GitHub Integration Page (UI)
- [ ] Create `/workspace/[id]/github` page
- [ ] Show GitHub App installation info:
  - Installation status (active/suspended/not installed)
  - Installed by (user who connected)
  - Connected repositories list with status
  - Webhook delivery status (last received timestamp)
  - Indexing status per repo (vectorization progress)
- [ ] List recent PRs from DB per connected repo
- [ ] "Add more repositories" button → GitHub App reinstall flow
- [ ] "Suspend access" button → suspends GitHub App installation
- [ ] "Uninstall Alfred" button → removes GitHub App from their account
- [ ] Show clear installation instructions if not yet installed

**Test:** Page shows correct GitHub App installation info. All connected repos listed. Webhook status shows last received timestamp. "Add more repositories" opens GitHub App settings.

---

### 8.4 — Manual PR Linking
- [ ] Build PR link UI on feature detail page (IN_DEVELOPMENT state)
- [ ] Dropdown: shows open PRs from connected repo
- [ ] On select: call `github.linkPR` tRPC procedure
  - Updates `pull_requests` table with feature_id
  - Updates feature status to PR_LINKED
  - Fires Inngest `ai-review` event

**Test:** Select a PR from dropdown → feature status changes to PR_LINKED → review workflow triggers.

---

### 8.5 — PR Description Auto-Generator
- [ ] Create Inngest workflow step inside `pr-ingestion`:
  - After PR is linked to a feature
  - Fetch: PRD requirements, engineering tasks, acceptance criteria
  - Call Claude (Haiku — cheap, fast) to generate PR description
  - Structured output:
    ```
    ## What does this PR do?
    [Claude-generated summary based on PRD]

    ## Changes made:
    [List of tasks completed]

    ## Acceptance criteria satisfied:
    [Checklist from PRD]

    ## Alfred feature link:
    https://alfred.ai/features/feat_123
    ```
  - Post generated description to GitHub PR via Octokit
    (`PATCH /repos/{owner}/{repo}/pulls/{pull_number}`)
  - Save generated description to `pull_requests.body` in DB
- [ ] Show in feature detail UI (IN_DEVELOPMENT tab):
  - "Alfred generated your PR description" confirmation
  - Preview of the generated description
  - "Regenerate" button if developer wants a new version

**Test:** Link a PR to a feature → within 30 seconds → GitHub PR description is auto-populated with structured content → Alfred confirmation shows in UI.

---

## Phase 9 — AI Review Loop
> Goal: Alfred reviews PRs, finds issues, re-reviews after fixes

### 9.1 — AI Review Workflow (Backend)
- [ ] Create Inngest workflow: `ai-review`
  - Step 1: Fetch PR diff from DB
  - Step 2: Fetch PRD + acceptance criteria from DB
  - Step 3: Fetch engineering tasks from DB
  - Step 4: Query pgvector for top 5 related code chunks
  - Step 5: Update progress: "Alfred is reviewing your PR..."
  - Step 6: Call Claude with full context (diff + PRD + tasks + vector context)
  - Step 7: Parse structured JSON response (summary + issues array)
  - Step 8: Save to `ai_reviews` table
  - Step 9: Save each issue to `review_issues` table
  - Step 10: Post review comment to GitHub PR via Octokit
  - Step 11: If blocking issues → update feature status to CHANGES_REQUESTED
  - Step 12: If no blocking issues → update feature status to REVIEW_PASSED
  - Step 13: Create notification with review result

**Test:** Link a real PR → review workflow runs → `ai_reviews` row created → `review_issues` rows created → comment posted on GitHub PR → feature status updated.

---

### 9.2 — Review Display (UI)
- [ ] Create Review tab on feature detail page
- [ ] Show current review:
  - Review number (#1, #2, #3...)
  - Summary paragraph
  - Issue list:
    - 🔴 BLOCKING issues (red badge)
    - 🟡 NON-BLOCKING issues (yellow badge)
  - For each issue: title, description, file path, suggested fix, PRD requirement violated
  - Files Alfred referenced (from vector search)
- [ ] Show "Waiting for Alfred..." state with progress bar when review is running
- [ ] "Request Re-review" button (only shown after developer pushes fixes)

**Test:** Review displays correctly. Blocking issues show red. Non-blocking show yellow. PRD violation reference shows. Progress bar shows during review.

---

### 9.3 — Re-Review Workflow
- [ ] Create Inngest workflow: `re-review`
  - Same as ai-review but:
  - Increments review_number
  - Fetches previous review issues for comparison
  - Step: "Comparing with previous review..."
  - Notes which previous blocking issues are now resolved
  - Step: saves new review with resolution tracking
- [ ] Trigger: new commit pushed to PR (webhook `synchronize` event)
- [ ] OR: manual "Request Re-review" button

**Test:** Push a new commit to a PR in CHANGES_REQUESTED state → re-review triggers automatically → new review cycle created with incremented number.

---

### 9.4 — Review History (UI)
- [ ] Create History tab on feature detail page
- [ ] Show all review cycles in reverse chronological order
- [ ] Each cycle shows:
  - Review #N (date)
  - Status: PASSED / FAILED
  - Blocking count / Non-blocking count
  - Expandable issue list
  - Which issues were fixed since last review
- [ ] Visual timeline of the review journey

**Test:** Complete 2 review cycles → history shows both. Second review shows which issues from first were resolved.

---

## Phase 10 — Human Approval & Ship
> Goal: Human reviewer gate → approve → ship

### 10.1 — Release Readiness Check (Backend)
- [ ] Create Inngest workflow: `release-readiness`
  - Step 1: Verify all blocking issues are resolved
  - Step 2: Verify PR is merged (or open — configurable)
  - Step 3: Verify all tasks are DONE
  - Step 4: Call Claude with release readiness prompt
  - Step 5: Generate release summary
  - Step 6: Update feature status to PENDING_APPROVAL
  - Step 7: Create notification for reviewers: "Feature ready for approval"

**Test:** All blocking issues resolved → release readiness check passes → feature moves to PENDING_APPROVAL → reviewer notified.

---

### 10.2 — Approval Page (UI)
- [ ] Create Approval tab on feature detail page
- [ ] Only visible to: owner, admin, reviewer roles
- [ ] Show approval checklist:
  - ✓ PRD generated and approved
  - ✓ All tasks completed
  - ✓ PR linked
  - ✓ AI review passed
  - ✓ No blocking issues
  - ✓ Release readiness check passed
- [ ] Show: PRD summary, task completion, PR details, full AI review history
- [ ] "Approve & Ship" button (green)
- [ ] "Reject" button (red) with reason input
- [ ] Both buttons disabled for developer/viewer roles

**Test:** Login as developer → Approve button is disabled. Login as reviewer → button is enabled. Click Approve → feature status = SHIPPED. Click Reject → feature status = REJECTED with reason stored.

---

### 10.3 — Ship Confirmation
- [ ] On approval: update feature `shipped_at` timestamp
- [ ] Create notification: "🎉 Feature shipped!"
- [ ] Show confetti animation on the feature page
- [ ] Update dashboard shipped count
- [ ] Feature card shows "SHIPPED ✓" badge in green

**Test:** Approve a feature → shipped_at set in DB → dashboard count increments → confetti shows → badge turns green.

---

### 10.4 — Auto Changelog Generation
- [ ] On feature SHIPPED → trigger Inngest `changelog-generation` step:
  - Step 1: Fetch feature title, PRD summary, tasks completed
  - Step 2: Call Claude (Haiku — cheap) to generate changelog entry:
    - Type: feature / fix / improvement (inferred from PRD)
    - One clean paragraph describing what shipped
    - Written for end users, not developers
  - Step 3: Auto-generate version number:
    - Query last changelog entry for workspace
    - Increment minor version (v1.0.0 → v1.1.0)
    - Or patch version for fixes (v1.0.0 → v1.0.1)
  - Step 4: Save to `changelog` table
  - Step 5: Update workflow progress: "Changelog updated"
- [ ] Create `/workspace/[id]/changelog` page:
  - Groups entries by version
  - Shows date, version, type badge, entry text
  - Each entry links back to the feature
  - Clean timeline layout
  - Public shareable URL: `/changelog/[workspaceSlug]`
- [ ] Add changelog link to:
  - Dashboard sidebar
  - Feature detail page after shipping
  - Notification: "Changelog updated — v1.4.0"
- [ ] Add `changelog` to DB schema (already added in 6.1.1)

**Test:** Approve a feature → changelog entry auto-generated → appears on /changelog page → version number incremented correctly → type badge correct (feature/fix/improvement).

---

## Phase 11 — Billing & Plan Gates
> Goal: Razorpay integration with real feature gating

### 11.1 — Razorpay Setup
- [ ] Create Razorpay account (manual — needs real account)
- [ ] Create 2 plans in Razorpay dashboard: Pro (₹999/mo) and Team (₹2999/mo) (manual — needs real account; set the resulting plan IDs as `RAZORPAY_PLAN_ID_PRO`/`RAZORPAY_PLAN_ID_TEAM`)
- [x] Install Razorpay SDK
- [x] Create Razorpay webhook endpoint: `apps/web/app/api/webhooks/razorpay/route.ts`
- [x] Verify Razorpay webhook signature
- [x] Handle events: `subscription.activated`, `subscription.cancelled`, `payment.failed`

**Test:** Razorpay webhook test ping → signature verified → event logged. (untested live — needs real Razorpay account + webhook secret)

---

### 11.2 — Billing Gates in tRPC
- [x] Create `checkBillingLimit` utility function (`packages/db/src/billing-limits.ts`):
  - Takes: workspaceId, limitType (features/prd_generations/ai_reviews/repos/members)
  - Queries workspace plan from DB
  - Returns: allowed (boolean) + current usage + limit
- [x] Add billing check to:
  - `feature.create` → max 3 on free
  - PRD generation workflow → max 2 on free
  - AI review workflow → max 5 on free
  - `github.connectRepository` → max 1 on free
  - `workspace.inviteMember` → max 1 on free
- [x] Return clear error: "You've reached your free plan limit. Upgrade to Pro."

**Test:** Create 3 features on free plan → 4th attempt returns billing error. Upgrade to Pro → can create unlimited. (logic in place — untested live, needs a real Razorpay upgrade flow)

---

### 11.3 — Billing Page (UI)
- [x] Create `/workspace/[id]/billing` page
- [x] Show current plan with usage meters:
  - Features used: 3/3
  - PRD generations, AI reviews, Repos connected, Team members
- [x] Pricing cards: Free / Pro / Team
- [x] "Upgrade" button → Razorpay checkout flow
- [x] Show current subscription status
- [ ] Show billing history (skipped — no invoice list endpoint built; would need Razorpay's invoices API)

**Test:** Free tier shows correct limits. Click Upgrade → Razorpay modal opens → complete test payment → plan upgrades in DB → limits update. (untested live — needs real Razorpay plan IDs + a test payment)

---

## Phase 12 — Real-time & Notifications
> Goal: Live updates without page refresh

### 12.1 — Server-Sent Events (SSE)
- [ ] Create SSE endpoint: `apps/web/app/api/sse/[workspaceId]/route.ts`
- [ ] On Inngest workflow step completion → write event to SSE stream
- [ ] Frontend subscribes to SSE on workspace pages
- [ ] On SSE event received → invalidate relevant tRPC queries

**Test:** Keep feature page open. Trigger a workflow. Without refreshing → UI updates automatically when workflow completes.

---

### 12.2 — Notifications Bell
- [ ] Create tRPC procedure: `notification.getUnread`
- [ ] Show unread count badge on bell icon
- [ ] Click bell → notification dropdown:
  - Each notification with icon, message, timestamp
  - Click notification → navigate to relevant feature
  - "Mark all as read" button
- [ ] Auto-refresh unread count every 30 seconds

**Test:** Create a notification in DB → bell shows badge count. Click bell → notification shows. Click notification → navigates to correct feature.

---

### 12.3 — Alfred Daily Digest
- [ ] Install Resend for email: `pnpm add resend`
- [ ] Add `RESEND_API_KEY` to `.env.example` and `.env.local`
- [ ] Get API key from resend.com (free tier: 3000 emails/month)
- [ ] Create Inngest scheduled workflow: `daily-digest`
  - Schedule: every day at 9:00 AM (cron: `0 9 * * *`)
  - Step 1: Fetch all active workspaces
  - Step 2: For each workspace, fetch each member
  - Step 3: For each member build their digest:
    - 🔴 Needs attention: blocking issues assigned to them
    - 🔴 Pending approvals: features waiting for their review
    - 🟡 In progress: features they own currently being processed
    - ✅ Shipped yesterday: features that shipped in last 24hrs
  - Step 4: Call Claude (Haiku) to write personalized intro line:
    - "Good morning Aks! You have a busy day ahead."
    - "Hey Rahul, smooth sailing today — one approval needed."
  - Step 5: Send email via Resend with digest content
  - Step 6: Create in-app notification: "Your daily digest is ready"
- [ ] Build digest email template:
  ```
  Subject: Your Alfred digest — [Day], [Date]

  Good morning [Name] 👋

  🔴 Needs your attention:
  → PR #47 has 2 blocking issues waiting for fixes
  → "Search API" is pending your approval

  🟡 In progress:
  → "Dark Mode" is being reviewed by Alfred
  → "CSV Export" PRD is being generated

  ✅ Shipped yesterday:
  → "Auth Refactor" was approved and shipped

  [ Open Alfred → ]
  ```
- [ ] Add digest preferences to user settings:
  - Enable/disable daily digest
  - Choose delivery time (default 9 AM)
  - Choose timezone

**Test:** Trigger the Inngest scheduled workflow manually → email received in inbox → content matches real DB state → in-app notification created → clicking email link opens correct Alfred page.

---

## Phase 13 — Repo Vectorization
> Goal: Codebase indexed in pgvector for smarter AI reviews

### 13.1 — Vectorization Workflow (Inngest)
- [ ] Create Inngest workflow: `repo-vectorization`
  - Step 1: Fetch repository from DB (includes `installation_id`)
  - Step 2: Get installation-specific Octokit client using `installation_id`
  - Step 3: Fetch file tree via Octokit (`GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`)
  - Step 4: Filter to code files only (by extension)
  - Step 5: Update progress: "Indexing your codebase... (0/247 files)"
  - Step 6: For each file batch (10 at a time):
    - Fetch file content via Octokit (using installation token)
    - Chunk into 500-token segments
    - Embed via OpenAI text-embedding-3-small
    - Upsert to `code_chunks` table
    - Update progress percentage
  - Step 7: Mark repository as indexed
  - Step 8: Update workflow progress: "Complete — 247 files indexed"

**Test:** Connect a real repo via GitHub App → vectorization workflow runs → `code_chunks` table populated → repository `is_indexed` = true → progress visible in UI during indexing. Verify Octokit used installation token, not a PAT.

---

### 13.2 — Vector Search in Review
- [ ] Create vector search utility in `packages/ai`:
  - Takes: PR diff text
  - Embeds the diff
  - Queries pgvector for top 5 similar chunks
  - Returns chunks with file paths
- [ ] Wire into `ai-review` workflow (Step 4 already planned)
- [ ] Show referenced files in review UI

**Test:** Trigger a review → check Alfred's review references real files from the codebase. Files listed in Review tab.

---

## Phase 14 — Polish & Production Readiness
> Goal: Production signals that evaluators reward

### 14.1 — Error Handling
- [ ] Create global error boundary in Next.js
- [ ] Create tRPC error formatter (consistent error shape)
- [ ] Add toast notifications for all errors
- [ ] Handle specific errors:
  - UNAUTHORIZED → redirect to login
  - FORBIDDEN → show "Access denied" message
  - NOT_FOUND → show 404 component
  - BILLING_LIMIT → show upgrade prompt
- [ ] Add Sentry error monitoring (10 lines of setup)

**Test:** Trigger each error type → correct UI response shown. Sentry receives test error.

---

### 14.2 — Loading & Empty States
- [ ] Every list page has:
  - Loading skeleton (while fetching)
  - Empty state with CTA (when no data)
  - Error state with retry (if fetch fails)
- [ ] Every form has:
  - Loading state on submit button
  - Disabled state while submitting
  - Success state after completion
- [ ] Every async workflow has:
  - Progress bar
  - Step message ("Alfred is writing your PRD...")
  - Completion state

**Test:** Load each page on slow network (throttle in DevTools) → skeletons show. Clear DB → empty states show with correct CTAs.

---

### 14.3 — Landing Page
- [ ] Create `/` landing page with:
  - Hero: headline + subheadline + CTA buttons
  - "How it works" section (5 phases visualized)
  - Feature highlights (AI review, Kanban, GitHub integration)
  - Pricing section (3 tiers)
  - Competitor comparison table
  - Footer with links
- [ ] Make it responsive

**Test:** Landing page loads fast. Pricing section matches actual billing gates. CTA buttons link to signup.

---

### 14.4 — Demo Seeding
- [ ] Create seed script `packages/db/seed.ts`:
  - Creates demo user: `demo@alfred.ai / demo123`
  - Creates workspace: "Demo Corp"
  - Creates 3 features in different states:
    - Feature 1: SHIPPED (full history visible)
    - Feature 2: CHANGES_REQUESTED (review in progress)
    - Feature 3: PRD_READY (awaiting task generation)
  - Seeds PRDs, tasks, reviews for each
  - Seeds notifications
- [ ] Add `db:seed` script to package.json
- [ ] Test demo account on production

**Test:** Run seed → login as demo@alfred.ai → dashboard shows pre-populated data. All tabs on each feature show realistic content.

---

## Phase 15 — Documentation & README
> Goal: 5 rubric points + evaluator trust

### 15.1 — README
- [ ] Write README with these sections:
  - Project overview (what Alfred does, the 5 phases)
  - Tech stack table
  - Architecture diagram (embed image)
  - Setup instructions (step by step)
  - Environment variables (all variables with descriptions)
  - Database schema notes
  - GitHub integration setup guide
  - Inngest workflow explanation (all 10 workflows)
  - AI features implemented:
    - Clarification agent
    - PRD generation
    - Task generation
    - Smart duplicate detection
    - PR description auto-generator
    - AI code review
    - Release readiness check
    - Auto changelog generation
    - Daily digest personalization
  - Authorization model explanation (Zanzibar-inspired)
  - Permission caching explanation (LRU + Redis)
  - Vector search explanation (pgvector)
  - Scalar API docs link (`/docs`)
  - Known limitations & what's next
  - Demo account credentials
  - Live URL

**Test:** Send README to a developer friend who doesn't know Alfred. Can they set it up locally following only the README? If yes → it's good.

---

### 15.2 — Architecture Diagram
- [ ] Create architecture diagram in Eraser.io or Excalidraw
- [ ] Show all components and data flow:
  - User → Next.js → tRPC → Services → DB
  - Inngest workflows
  - GitHub webhooks
  - AI SDK
  - pgvector
  - Redis cache
  - Razorpay
- [ ] Export as PNG
- [ ] Embed in README and landing page

**Test:** Someone can understand the full system from the diagram alone without reading code.

---

### 15.3 — Environment Variables Documentation
- [ ] Update `.env.example` with every variable
- [ ] Add a comment above each variable explaining what it is and where to get it
- [ ] Add setup guides for:
  - GitHub App creation + installation guide
  - GitHub webhook setup (automatic via GitHub App)
  - ngrok setup for local development
  - Neon PostgreSQL setup
  - Upstash Redis setup
  - Inngest setup
  - Razorpay setup

**Test:** Follow your own setup guide from scratch on a fresh machine. Takes under 15 minutes.

---

### 15.4 — Scalar API Documentation
> Goal: Beautiful, interactive API docs that make the evaluator trust your backend depth

- [ ] Install Scalar in `apps/web`:
  - `pnpm add @scalar/nextjs-api-reference`
- [ ] Generate OpenAPI spec from your tRPC router:
  - Install `trpc-openapi` package
  - Add `.meta({ openapi: { method, path } })` to every tRPC procedure you want documented
  - Create OpenAPI document generator in `packages/trpc/src/openapi.ts`
  - Export the full OpenAPI JSON spec
- [ ] Create the Scalar docs route: `apps/web/app/api/docs/route.ts`
  - Returns your OpenAPI JSON spec at `/api/docs`
- [ ] Create the Scalar UI page: `apps/web/app/docs/page.tsx`
  - Mounts Scalar's interactive UI at `/docs`
  - Configure with Alfred branding (title, theme color, logo)
- [ ] Document these procedure groups with OpenAPI meta:
  - `workspace.*` — all workspace CRUD operations
  - `feature.*` — feature lifecycle procedures
  - `prd.*` — PRD generation and retrieval
  - `task.*` — task management
  - `github.*` — GitHub integration procedures
  - `review.*` — AI review procedures
  - `billing.*` — plan and subscription management
- [ ] Add request/response examples to each documented procedure
- [ ] Add authentication scheme to OpenAPI spec (Bearer token)
- [ ] Link to `/docs` from:
  - Landing page footer: "API Documentation"
  - README: "API docs available at https://yourdomain.com/docs"
  - Dashboard sidebar (for developers)

**Test:** Visit `https://yourdomain.com/docs` → Scalar UI loads with Alfred branding → all procedure groups visible → click any endpoint → shows request schema, response schema, and example. Try "Send Request" on a public endpoint → returns real response.

---
> Goal: Highest score-per-effort tests that prove the system works correctly

### 16.1 — Test Setup
- [ ] Install Vitest in the monorepo root (faster than Jest, works with TypeScript natively)
- [ ] Install testing utilities:
  - `@testing-library/react` — for component tests
  - `@testing-library/user-event` — for simulating user interactions
  - `supertest` — for API route testing
  - `@vitest/coverage-v8` — for coverage reports
- [ ] Create `vitest.config.ts` at root (covers all packages)
- [ ] Add `test` and `test:coverage` scripts to root `package.json`
- [ ] Add test script to `turbo.json` pipeline
- [ ] Create test database: separate `DATABASE_URL_TEST` in `.env.test`

**Test:** Run `pnpm test` from root → Vitest starts → 0 tests found but no errors. Test infrastructure is working.

---

### 16.2 — Validator Unit Tests (Highest ROI — Start Here)
> These test your Zod schemas in `packages/validators`. Fast, zero dependencies, high value.

- [ ] Create `packages/validators/__tests__/feature.test.ts`
  - Test `createFeature` schema: valid input passes, missing title fails, empty string fails
  - Test `submitClarification` schema: valid reply passes, empty content fails
- [ ] Create `packages/validators/__tests__/workspace.test.ts`
  - Test `createWorkspace` schema: valid name passes, slug with spaces fails, too-short name fails
- [ ] Create `packages/validators/__tests__/github.test.ts`
  - Test `connectRepo` schema: valid installation_id passes, missing installation_id fails
- [ ] Create `packages/validators/__tests__/billing.test.ts`
  - Test plan enum: only free/pro/team accepted, invalid plan fails

**Test:** `pnpm test packages/validators` → all tests pass. Change a validator rule → corresponding test fails.

---

### 16.3 — Permission Logic Unit Tests (Critical Path)
> Tests your Zanzibar-inspired permission checks. This is the most important logic to test.

- [ ] Create `packages/trpc/__tests__/permissions.test.ts`
  - Test: owner role → can approve features ✓
  - Test: developer role → cannot approve features ✗
  - Test: viewer role → can only read ✗ for all write actions
  - Test: reviewer role → can approve but cannot create features ✗
  - Test: user not in workspace → FORBIDDEN on all actions ✗
  - Test: cache hit → returns cached role without DB query
  - Test: cache miss → queries DB and populates cache
  - Test: cache invalidation → after role change, old cached role not returned

**Test:** All 8 permission tests pass. These prove your authorization model is correct.

---

### 16.4 — Feature State Machine Tests (Core Workflow)
> Tests that feature status transitions are enforced correctly at the service layer.

- [ ] Create `packages/trpc/__tests__/stateMachine.test.ts`
  - Test: DRAFT → CLARIFYING is valid ✓
  - Test: DRAFT → SHIPPED is invalid ✗ (cannot skip steps)
  - Test: PRD_READY → TASK_GENERATION is valid ✓
  - Test: SHIPPED → IN_DEVELOPMENT is invalid ✗ (cannot go backwards)
  - Test: CHANGES_REQUESTED → RE_REVIEWING is valid ✓
  - Test: PENDING_APPROVAL → SHIPPED requires reviewer role ✓
  - Test: PENDING_APPROVAL → SHIPPED with developer role → FORBIDDEN ✗

**Test:** All 7 state machine tests pass. These directly prove the core workflow is enforced.

---

### 16.5 — tRPC Router Integration Tests (API Layer)
> Tests actual tRPC procedures against a real test database.

- [ ] Create test helpers:
  - `createTestUser()` — inserts user in test DB, returns user + session
  - `createTestWorkspace(userId)` — creates workspace + membership
  - `createTestCaller(user)` — creates tRPC caller with auth context
- [ ] Create `packages/trpc/__tests__/workspace.router.test.ts`:
  - Test: `workspace.create` with valid input → workspace row in DB ✓
  - Test: `workspace.create` with duplicate slug → error ✗
  - Test: `workspace.getById` for member → returns workspace ✓
  - Test: `workspace.getById` for non-member → FORBIDDEN ✗
  - Test: `workspace.inviteMember` by owner → invite row in DB ✓
  - Test: `workspace.inviteMember` by viewer → FORBIDDEN ✗
- [ ] Create `packages/trpc/__tests__/feature.router.test.ts`:
  - Test: `feature.create` on free plan (1st) → succeeds ✓
  - Test: `feature.create` on free plan (4th) → billing error ✗
  - Test: `feature.create` by viewer role → FORBIDDEN ✗
  - Test: `feature.updateStatus` to invalid transition → error ✗

**Test:** All integration tests pass against test DB. Test DB is cleaned between each test run.

---

### 16.6 — GitHub Webhook Handler Tests
> Tests that webhook signature verification works correctly.

- [ ] Create `apps/web/__tests__/webhooks/github.test.ts`
  - Test: valid signature + valid payload → 200 returned + Inngest event fired ✓
  - Test: invalid signature → 401 returned ✗
  - Test: missing signature header → 401 returned ✗
  - Test: valid `pull_request.opened` event → PR ingestion triggered ✓
  - Test: valid `pull_request.synchronize` event → re-review triggered ✓
  - Test: unknown event type → 200 returned (ignored gracefully) ✓

**Test:** All 6 webhook tests pass. These prove your GitHub integration is secure and correct.

---

### 16.7 — Billing Gate Tests
> Tests that billing limits are actually enforced at the API layer.

- [ ] Create `packages/trpc/__tests__/billing.test.ts`
  - Test: free plan workspace → `feature.create` blocked after 3 features ✗
  - Test: pro plan workspace → `feature.create` allowed after 3 features ✓
  - Test: free plan → AI review blocked after 5 uses ✗
  - Test: free plan → second repo connection blocked ✗
  - Test: `checkBillingLimit` returns correct current usage counts ✓

**Test:** All 5 billing tests pass. These prove billing gates are real, not decorative.

---

### 16.8 — Component Tests (UI Layer — Selective)
> Only test components with real logic. Skip purely presentational components.

- [ ] Create `apps/web/__tests__/components/FeatureStatusBadge.test.tsx`
  - Test: SHIPPED status → green badge ✓
  - Test: CHANGES_REQUESTED status → red badge ✓
  - Test: REVIEWING status → yellow badge ✓
- [ ] Create `apps/web/__tests__/components/KanbanBoard.test.tsx`
  - Test: tasks render in correct columns ✓
  - Test: drag task → `task.updateStatus` procedure called ✓
- [ ] Create `apps/web/__tests__/components/ApprovalGate.test.tsx`
  - Test: reviewer role → Approve button enabled ✓
  - Test: developer role → Approve button disabled ✓
  - Test: viewer role → Approve button not rendered ✓

**Test:** All component tests pass. The approval gate test directly proves the UI enforces roles.

---

### 16.9 — AI Agent Output Tests (Prompt Validation)
> Tests that AI agent outputs are parsed and validated correctly.

- [ ] Create `packages/ai/__tests__/prd.test.ts`
  - Mock the Claude API response
  - Test: valid PRD JSON → parsed into all 7 fields ✓
  - Test: missing `acceptance_criteria` field → error thrown, not silently ignored ✗
  - Test: malformed JSON response → handled gracefully with retry ✓
- [ ] Create `packages/ai/__tests__/review.test.ts`
  - Mock the Claude API response
  - Test: valid review JSON with blocking issues → parsed correctly ✓
  - Test: `blocking_count` matches actual blocking issues in array ✓
  - Test: issue missing `severity` field → defaults to NON_BLOCKING ✓

**Test:** AI output parsing is validated. Bad AI responses don't silently corrupt the DB.

---

### 16.10 — End-to-End Test (The Crown Jewel)
> One full lifecycle test. This is what you demo to show everything works together.

- [ ] Install Playwright: `pnpm add -D @playwright/test`
- [ ] Create `apps/web/e2e/full-lifecycle.spec.ts`:
  - Step 1: Navigate to `/signup` → create account
  - Step 2: Create workspace
  - Step 3: Submit feature request: "Add dark mode support"
  - Step 4: Reply to Alfred's clarification question
  - Step 5: Wait for PRD to generate → verify PRD page shows content
  - Step 6: Approve PRD → verify tasks appear on Kanban
  - Step 7: Move a task to IN PROGRESS
  - Step 8: Verify feature status = PLANNING
  - Step 9: (Mock the GitHub PR link) → verify review triggers
  - Step 10: Verify review page shows issues
- [ ] Run against local dev server
- [ ] Add to CI pipeline: runs on PR to main

**Test:** E2E test passes end-to-end without human interaction. This is your most powerful demo asset.

---

### 16.11 — Test Coverage Report
- [ ] Run `pnpm test:coverage` → generates coverage report
- [ ] Target coverage for critical paths:
  - `packages/validators` → 100% (easy, pure functions)
  - Permission logic → 100% (critical path)
  - State machine → 100% (critical path)
  - Billing gates → 90%+
  - tRPC routers → 70%+
  - Components → 50%+ (only logic-heavy ones)
- [ ] Add coverage badge to README
- [ ] Screenshot coverage report for README

**Test:** Coverage report generates. Critical path files show 90%+ coverage.

---

## Phase 17 — GitHub Actions CI/CD Pipeline
> Goal: Every push is tested and validated before it touches production

### 16.1 — CI Pipeline (Run on Every PR)
- [ ] Create `.github/workflows/ci.yml`
- [ ] Trigger on: `pull_request` to `main` and `push` to `main`
- [ ] Jobs to run in parallel:
  - `typecheck` — runs `tsc --noEmit` across all packages
  - `lint` — runs ESLint across all packages via Turborepo
  - `test` — runs the full test suite
  - `build` — runs `turbo build` to verify it compiles
- [ ] Add Node.js version matrix: Node 20
- [ ] Cache `node_modules` and `.turbo` between runs for speed
- [ ] Fail the entire pipeline if ANY job fails
- [ ] Add status badge to README

**Test:** Push a branch with a TypeScript error → CI fails on `typecheck` job → PR shows red ✗. Fix the error → CI passes → PR shows green ✓.

---

### 16.2 — Environment Secrets in GitHub
- [ ] Go to GitHub repo → Settings → Secrets and Variables → Actions
- [ ] Add all required secrets:
  - `DATABASE_URL` (test database — separate from production)
  - `ANTHROPIC_API_KEY`
  - `UPSTASH_REDIS_URL`
  - `UPSTASH_REDIS_TOKEN`
  - `INNGEST_EVENT_KEY`
  - `INNGEST_SIGNING_KEY`
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
  - `WEBHOOK_SECRET`
  - `DO_SSH_KEY` (DigitalOcean deploy key — added in Phase 17)
  - `DO_HOST` (your Droplet IP)
  - `DO_USER` (usually `root` or `ubuntu`)
- [ ] Never put real secrets in `.env.example` — only placeholder values

**Test:** Trigger a CI run → workflow can access all secrets without errors. No "secret not found" failures.

---

### 16.3 — CD Pipeline (Deploy on Merge to Main)
- [ ] Create `.github/workflows/deploy.yml`
- [ ] Trigger on: `push` to `main` branch ONLY (after CI passes)
- [ ] Jobs:
  - `deploy` — SSHs into DigitalOcean Droplet and runs deploy script
- [ ] Deploy steps inside the workflow:
  - SSH into Droplet
  - `git pull origin main`
  - `npm install` (install any new dependencies)
  - `turbo build` (rebuild the app)
  - Run DB migrations: `drizzle-kit migrate`
  - Restart the app via PM2: `pm2 restart alfred`
- [ ] Add deployment notification (optional): post to Slack or just log

**Test:** Merge a PR to main → GitHub Actions triggers deploy job → Droplet pulls new code → app restarts → live site reflects the change within 2 minutes.

---

### 16.4 — Branch Protection Rules
- [ ] Go to GitHub repo → Settings → Branches
- [ ] Add rule for `main` branch:
  - [ ] Require pull request before merging
  - [ ] Require status checks to pass (select: typecheck, lint, test, build)
  - [ ] Require branches to be up to date before merging
  - [ ] Do not allow force pushes
  - [ ] Do not allow deletion
- [ ] This means: nothing broken ever reaches production

**Test:** Try to push directly to `main` → GitHub blocks it. Open a PR with failing CI → merge button is greyed out.

---

### 16.5 — Database Migration Safety in CI/CD
- [ ] Create a separate `DATABASE_URL_TEST` pointing to a test database
- [ ] CI pipeline uses test DB — never touches production data
- [ ] CD pipeline runs migrations on production DB BEFORE restarting the app
- [ ] Add migration rollback script: `drizzle-kit rollback` (for emergencies)
- [ ] Document rollback procedure in README

**Test:** Deploy a migration in CD pipeline → production DB schema updates → app restarts with new schema → no downtime.

---

## Phase 18 — DigitalOcean Deployment
> Goal: Alfred running on your own DigitalOcean Droplet with zero downtime deploys

### 17.1 — Create the Droplet
- [ ] Log in to DigitalOcean
- [ ] Create a new Droplet:
  - **Image:** Ubuntu 24.04 LTS
  - **Size:** Basic — 2 vCPUs, 4GB RAM, 80GB SSD (minimum for running Next.js + Node)
  - **Region:** Choose closest to your users (Bangalore for India)
  - **Authentication:** SSH Key (add your local machine's public key)
  - **Hostname:** `alfred-production`
- [ ] Enable backups (worth the extra cost)
- [ ] Note down the Droplet IP address

**Test:** SSH into the Droplet: `ssh root@YOUR_DROPLET_IP` → you're in. No password needed (SSH key auth).

---

### 17.2 — Server Initial Setup
- [ ] SSH into the Droplet
- [ ] Update all packages: `apt update && apt upgrade -y`
- [ ] Install Node.js 20 via NodeSource:
  - Add NodeSource repo
  - `apt install nodejs`
  - Verify: `node --version` → v20.x.x
- [ ] Install npm and pnpm globally
- [ ] Install PM2 globally: `npm install -g pm2`
  - PM2 keeps your app running, restarts on crash, starts on server reboot
- [ ] Install Nginx: `apt install nginx`
  - Nginx acts as reverse proxy (receives port 80/443 → forwards to port 3000)
- [ ] Install Certbot for SSL: `apt install certbot python3-certbot-nginx`
- [ ] Configure UFW firewall:
  - Allow SSH (port 22)
  - Allow HTTP (port 80)
  - Allow HTTPS (port 443)
  - Deny everything else
  - Enable UFW

**Test:** `node --version`, `pm2 --version`, `nginx -v` all return version numbers. `ufw status` shows active with correct rules.

---

### 17.3 — PostgreSQL on DigitalOcean
- [ ] Option A (Recommended): Use Neon.tech (managed PostgreSQL, free tier)
  - Already set up in Phase 1.1
  - Just use the same connection string
  - Zero server management
- [ ] Option B: DigitalOcean Managed Database
  - Create a PostgreSQL 16 cluster in DigitalOcean
  - Choose smallest plan (1GB RAM)
  - Add Droplet to trusted sources
  - Get connection string from dashboard
- [ ] Option C: Self-hosted PostgreSQL on the Droplet (NOT recommended — management overhead)
- [ ] Whichever option: add `DATABASE_URL` to server environment

**Test:** From the Droplet, run `psql $DATABASE_URL -c "SELECT 1"` → returns 1. Database is reachable from server.

---

### 17.4 — Clone & Build on Server
- [ ] Generate SSH key on the Droplet: `ssh-keygen -t ed25519`
- [ ] Add Droplet's public key to GitHub repo as a Deploy Key (read-only)
  - GitHub repo → Settings → Deploy Keys → Add key
- [ ] Clone the repo on the Droplet:
  - `git clone git@github.com:yourusername/alfred.git /var/www/alfred`
- [ ] Create `.env` file in `/var/www/alfred/apps/web/`:
  - Copy all production environment variables
  - Never commit this file — it lives only on the server
- [ ] Install dependencies: `cd /var/www/alfred && pnpm install`
- [ ] Build the app: `pnpm turbo build`
- [ ] Run DB migrations: `pnpm drizzle-kit migrate`
- [ ] Run seed script: `pnpm db:seed`

**Test:** Build completes with no errors. `ls apps/web/.next` → build output exists.

---

### 17.5 — PM2 Process Management
- [ ] Create PM2 ecosystem config file: `/var/www/alfred/ecosystem.config.js`
  - App name: `alfred`
  - Script: `node apps/web/.next/standalone/server.js`
  - Port: 3000
  - Env: production
  - Max memory restart: 1GB
  - Instances: 1 (or 2 if 4GB RAM Droplet)
  - Watch: false (CI/CD handles restarts)
- [ ] Start the app: `pm2 start ecosystem.config.js`
- [ ] Save PM2 process list: `pm2 save`
- [ ] Configure PM2 to start on server reboot: `pm2 startup`
  - Run the command PM2 outputs

**Test:** `pm2 status` → alfred shows `online`. `pm2 logs alfred` → no error logs. `curl localhost:3000` → HTML response. Reboot server → PM2 auto-starts alfred.

---

### 17.6 — Nginx Reverse Proxy
- [ ] Create Nginx config: `/etc/nginx/sites-available/alfred`
  - Server block for your domain
  - Listen on port 80
  - Proxy all requests to `localhost:3000`
  - Set proxy headers (X-Real-IP, X-Forwarded-For, Host)
  - Increase client body size for file uploads: `client_max_body_size 10M`
  - Enable gzip compression
- [ ] Enable the site: symlink to `/etc/nginx/sites-enabled/`
- [ ] Remove default Nginx site
- [ ] Test Nginx config: `nginx -t` → syntax ok
- [ ] Reload Nginx: `systemctl reload nginx`

**Test:** Visit `http://YOUR_DROPLET_IP` in browser → Alfred app loads (not Nginx default page).

---

### 17.7 — Domain & SSL Setup
- [ ] Purchase domain (tryalfred.in or heyalfred.dev — cheaper Indian domains)
- [ ] In your domain registrar DNS settings, add:
  - `A record`: `@` → your Droplet IP
  - `A record`: `www` → your Droplet IP
  - Wait for DNS propagation (5-30 minutes)
- [ ] Update Nginx config to use your domain name
- [ ] Get SSL certificate via Certbot:
  - `certbot --nginx -d yourdomain.com -d www.yourdomain.com`
  - Certbot auto-configures Nginx for HTTPS
  - Auto-renewal is set up automatically
- [ ] Verify HTTPS redirect works (HTTP → HTTPS automatic)
- [ ] Update all OAuth callback URLs to use `https://yourdomain.com`
- [ ] Update GitHub webhook URL to `https://yourdomain.com/api/webhooks/github`

**Test:** Visit `https://yourdomain.com` → padlock shows → app loads. Visit `http://yourdomain.com` → auto-redirects to HTTPS.

---

### 17.8 — Add Deploy Key to GitHub Actions
- [ ] Copy the Droplet's private SSH key content
- [ ] Add to GitHub Secrets as `DO_SSH_KEY`
- [ ] Add Droplet IP to GitHub Secrets as `DO_HOST`
- [ ] Add username to GitHub Secrets as `DO_USER` (root or ubuntu)
- [ ] The CD pipeline in Phase 16.3 will now use these to SSH in and deploy

**Test:** Trigger the CD workflow manually → it SSHs into your Droplet → pulls code → rebuilds → restarts PM2 → no manual action needed from you.

---

### 17.9 — Zero-Downtime Deploy Script
- [ ] Create `scripts/deploy.sh` in the repo root:
  - `git pull origin main`
  - `pnpm install --frozen-lockfile`
  - `pnpm turbo build`
  - `pnpm drizzle-kit migrate` (runs new migrations)
  - `pm2 reload alfred --update-env` (reload, not restart — zero downtime)
  - `echo "Deploy complete ✓"`
- [ ] Make it executable: `chmod +x scripts/deploy.sh`
- [ ] The GitHub Actions CD job calls this script via SSH

**Test:** While Alfred is serving traffic, trigger a deploy. App stays up during deploy. New version appears without any downtime gap.

---

### 17.10 — Monitoring & Logs
- [ ] Set up UptimeRobot (free):
  - Monitor `https://yourdomain.com` every 5 minutes
  - Alert via email if down
  - Create public status page: `status.yourdomain.com`
- [ ] PM2 log rotation:
  - Install: `pm2 install pm2-logrotate`
  - Max log size: 10MB
  - Keep last 7 days of logs
- [ ] Set up Sentry (already in Phase 14.1) — errors from production land here
- [ ] Add server monitoring in DigitalOcean:
  - Install DigitalOcean Monitoring Agent on Droplet
  - Set alert: if CPU > 80% for 5 min → email alert
  - Set alert: if RAM > 85% → email alert
  - Set alert: if disk > 80% → email alert

**Test:** UptimeRobot shows "Up" for your domain. Take the app down temporarily (`pm2 stop alfred`) → UptimeRobot sends alert email within 5 minutes. Restart app → alert clears.

---

### 17.11 — Production Smoke Test
- [ ] After first deploy, manually test the complete lifecycle:
  - [ ] Signup with email → workspace created
  - [ ] Connect GitHub repo → webhook registered
  - [ ] Submit feature request → clarification works
  - [ ] PRD generated → tasks created
  - [ ] Link a real PR → AI review runs
  - [ ] Review shows issues
  - [ ] Push fix → re-review triggers
  - [ ] Approve → feature shipped
- [ ] All Inngest workflows visible in Inngest Cloud dashboard
- [ ] All GitHub webhooks showing as delivered in GitHub repo settings
- [ ] No errors in PM2 logs or Sentry

**Test:** Complete the full lifecycle on production domain. Screenshot each step for your demo video.

---

## Final Checklist Before Submission

### Code Quality
- [ ] No TypeScript errors (`tsc --noEmit` passes)
- [ ] No console.log statements left in production code
- [ ] All shared packages are imported (no dead packages)
- [ ] All tRPC procedures have Zod input validation
- [ ] All DB queries have workspace isolation
- [ ] All tests passing (`pnpm test` green)
- [ ] Coverage on critical paths (permissions, state machine, billing) > 90%
- [ ] CI pipeline passing on `main` branch
- [ ] Branch protection enabled — no direct pushes to main
- [ ] E2E test passes on local dev server

### Evaluation Checklist
- [ ] GitHub webhook handler verifies signature
- [ ] Billing gates enforced at tRPC layer (not just UI)
- [ ] Permission checks use cache (not raw DB on every request)
- [ ] All Inngest workflows have visible progress in UI
- [ ] pgvector search results shown in review UI
- [ ] Review loop actually cycles (re-review creates new review row)
- [ ] Human approval gate enforced server-side
- [ ] Feature status machine transitions enforced in backend
- [ ] No hardcoded GitHub/PR data anywhere
- [ ] Scalar API docs live at `/docs` with real endpoint schemas
- [ ] OpenAPI spec generated from real tRPC procedures (not hand-written)

### Submission Assets
- [ ] Live URL working (on your DigitalOcean domain)
- [ ] Demo account seeded on production
- [ ] GitHub repo public with clean commit history
- [ ] CI pipeline passing (green checkmark on main branch)
- [ ] README complete with architecture diagram
- [ ] Demo video recorded (full lifecycle in under 3 min)
- [ ] Teaser video posted
- [ ] Product intro video posted
- [ ] LinkedIn posts (before + during + after)
- [ ] 4 blog posts published
- [ ] Corporate client quote obtained

---

## Phase Summary

| Phase | What You Build | Rubric Points |
|---|---|---|
| 0 | Monorepo scaffold | Engineering Quality |
| 1 | Full DB schema | Engineering Quality |
| 2 | BetterAuth | SaaS Experience |
| 3 | tRPC + middleware | Engineering Quality |
| 4 | Onboarding flow | SaaS Experience |
| 5 | Dashboard | SaaS Experience |
| 6 | Feature request + Smart Suggestions + clarification + PRD | Core Workflow + AI Quality |
| 7 | Task generation + Kanban | Core Workflow + AI Quality |
| 8 | GitHub webhooks + Octokit + PR Description Auto-Generator | GitHub Integration + AI Quality |
| 9 | AI review loop | AI Quality + Review Loop |
| 10 | Human approval + ship + Auto Changelog | Review Loop + AI Quality |
| 11 | Razorpay billing | SaaS Experience |
| 12 | Real-time + notifications + Daily Digest | Engineering Quality + AI Quality |
| 13 | pgvector repo indexing | AI Quality + GitHub |
| 14 | Polish + error states | SaaS Experience |
| 15 | README + Scalar API docs | Demo & Documentation |
| 16 | Testing (Vitest + Playwright) | Engineering Quality |
| 17 | GitHub Actions CI/CD pipeline | Engineering Quality |
| 18 | DigitalOcean deployment | Core Workflow |

---

*Built with Alfred. Shipped with confidence.*