# Alfred — Complete Build Roadmap
> Build it yourself, step by step. Test each subtask before moving to the next.
> Every section has a ✅ checkbox. Check it off when done and tested.

---

## How to Use This Roadmap

- Follow phases **in order** — each phase depends on the previous
- Every subtask has a **Test** step — do not skip it
- When stuck, ask for the code for that specific subtask only
- Mark tasks `✅` as you complete them

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