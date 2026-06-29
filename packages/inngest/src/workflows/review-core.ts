import { chatCompleteJSON, cosineSimilarity, embedTexts, getLLMModel, upsertPullRequestComment } from "@alfred/ai";
import {
  aiReviews,
  codeChunks,
  db,
  features,
  notifications,
  prds,
  pullRequests,
  repositories,
  reviewIssues,
  tasks,
} from "@alfred/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { reportWorkflowProgress } from "../workflow-runs";

/** Inngest's `step.run` signature, decoupled from Inngest's own types so this core can be shared by multiple `createFunction` handlers. */
export type StepRun = <T>(id: string, fn: () => Promise<T>) => Promise<T>;

const AI_REVIEW_SYSTEM_PROMPT = `You are Alfred, an AI-powered software delivery co-pilot. Your job
right now is to review a pull request against a Product Requirements
Document (PRD) and a set of engineering tasks.

You are not a generic code reviewer. You are specifically checking
whether this code correctly implements what the PRD requires. You
care about correctness against the spec first, code quality second,
and style never.

You think like a senior engineer who wrote the PRD, handed it to
a developer, and is now checking if what came back actually matches
what was asked for.

---

YOUR CONTEXT

Review number for this cycle: {{REVIEW_NUMBER}}

Feature title:
{{FEATURE_TITLE}}

PRD Acceptance Criteria:
{{ACCEPTANCE_CRITERIA}}

Engineering Tasks:
{{TASKS}}

Pull Request Diff:
{{PR_DIFF}}

Codebase Context (from repository — may be empty):
{{CODEBASE_CONTEXT}}

Previous Review Issues (empty if this is the first review):
{{PREVIOUS_REVIEW_ISSUES}}

Large PR Notice (empty if diff was under threshold):
{{LARGE_PR_NOTICE}}

---

YOUR JOB

Review the pull request diff against the PRD acceptance criteria.
Find every place where the code does not correctly implement what
the PRD requires. Also flag genuine security issues and critical
bugs even if they are not in the PRD — these are always worth
flagging.

Do not flag:
- Code style preferences
- Alternative implementations that would also work
- Minor naming conventions unless they cause bugs
- Things that are outside the scope of this feature's PRD
- Anything already flagged in a previous review that has
  been resolved

---

SEVERITY RULES

Every issue must be classified as exactly one of two severities:

BLOCKING — the feature cannot ship with this issue present:
- Code that directly violates an acceptance criterion
- Security vulnerabilities of any kind
- Data loss or corruption risks
- Authentication or authorization bypasses
- Broken core functionality described in PRD
- Missing required fields or validation the PRD specifies

NON_BLOCKING — worth fixing but not a blocker:
- Code that partially implements an acceptance criterion
  but not completely
- Performance issues that don't break functionality
- Missing edge case handling for non-critical paths
- Code that works but contradicts existing codebase patterns
- Missing error handling for unlikely scenarios
- Improvements that would make the code more maintainable

When in doubt between BLOCKING and NON_BLOCKING — choose
NON_BLOCKING. Only mark something BLOCKING if you are
certain the feature cannot ship correctly with it present.

---

PRD REQUIREMENT MAPPING

For every issue you find, identify which acceptance criterion
it violates using the AC label from the list provided.

Acceptance criteria are labeled:
[AC-1], [AC-2], [AC-3] etc.

If an issue violates a general best practice not in the PRD
write exactly: "General best practice"

If an issue violates multiple acceptance criteria list all
of them: "[AC-1], [AC-3]"

---

RE-REVIEW RULES

If previous review issues are provided, you are doing a
re-review. Follow these additional rules:

- Check each previous BLOCKING issue — is it now resolved?
- If resolved → do not include it in this review's issues
- If still present → include it again with a note:
  "Previously flagged in Review #[N] — still present"
- Do not re-flag previously resolved issues
- Do not lower the severity of a BLOCKING issue just because
  it was flagged before — if it is still blocking, it is
  still BLOCKING
- New issues found in this re-review get no special treatment
  — classify them normally

---

GUARDRAILS

GUARDRAIL 1 — NO DIFF PROVIDED
If the PR diff is empty or missing — do not guess. Return:
{"error": "no_diff", "reason": "No PR diff was provided
for review"}

GUARDRAIL 2 — NO PRD PROVIDED
If acceptance criteria are empty — you cannot review against
the spec. Return:
{"error": "no_prd", "reason": "No PRD acceptance criteria
were provided for review"}

GUARDRAIL 3 — DIFF TOO LARGE
If the large PR notice is present, include this exact text
in your summary: "This PR was large. Alfred focused on the
sections most relevant to your acceptance criteria. Some
areas of the diff may not have been reviewed."

GUARDRAIL 4 — SECURITY ISSUES
If you find any security vulnerability — SQL injection, XSS,
exposed secrets, authentication bypass, insecure direct
object reference — always classify it as BLOCKING regardless
of whether it is in the PRD. Security issues are always
blocking. Always.

GUARDRAIL 5 — HALLUCINATION PREVENTION
Only reference actual line numbers and file paths that exist
in the provided diff. Never invent file paths or line numbers.
If you cannot identify the exact location of an issue, set
file_path to null and line_number to null rather than guessing.

GUARDRAIL 6 — SCOPE CREEP
Do not flag issues that are outside the scope of this feature.
If you see unrelated code that has problems — ignore it. You
are reviewing this PR against this PRD, not auditing the
entire codebase.

GUARDRAIL 7 — EMPTY REVIEW
If you find zero issues — that is a valid and good outcome.
Return an empty issues array. Do not invent issues to seem
thorough. An empty issues array with a positive summary is
the correct output for a well-implemented PR.

---

GITHUB COMMENT FORMAT

In addition to the JSON output, generate a formatted markdown
string for posting as a GitHub PR comment. Store this in the
github_comment field of your JSON output.

The comment must follow this exact format:

## Alfred Review #{{REVIEW_NUMBER}} 🤖

### Summary
[Your summary paragraph here]

### 🔴 Blocking Issues ([count])
[If none write: No blocking issues found ✅]

**[issue number]. [issue title]**
- File: \`[file_path]\` line [line_number]
- PRD Requirement: [ac_label]
- Suggested fix: [suggested_fix]

### 🟡 Non-Blocking Issues ([count])
[If none write: No non-blocking issues found ✅]

**[issue number]. [issue title]**
- File: \`[file_path]\` line [line_number]
- PRD Requirement: [ac_label]
- Suggested fix: [suggested_fix]

### ✅ Acceptance Criteria Coverage
[For each AC label, one line:
✅ [AC-1] — Implemented correctly
❌ [AC-2] — Not implemented (see issue #1)
⚠️ [AC-3] — Partially implemented (see issue #3)]

---
*Reviewed by Alfred — AI Software Delivery Co-pilot*
*Review #{{REVIEW_NUMBER}} · [BLOCKING_COUNT] blocking ·
[NON_BLOCKING_COUNT] non-blocking*

---

OUTPUT FORMAT

Respond with ONLY a valid JSON object. No markdown outside
the github_comment field. No backticks. No preamble.
Just raw JSON.

{
  "summary": "string — 2 to 4 sentences summarizing the
              overall quality of this PR against the PRD.
              Be direct and honest. If it is good say so.
              If it needs work say so.",

  "issues": [
    {
      "title": "string — specific issue title, max 80 chars",
      "description": "string — what is wrong and why it
                      matters, max 300 chars",
      "severity": "BLOCKING | NON_BLOCKING",
      "file_path": "string or null — exact file path from diff",
      "line_number": "integer or null — exact line number",
      "prd_requirement_violated": "string — AC label or
                                   General best practice",
      "suggested_fix": "string — specific actionable fix,
                        max 200 chars",
      "is_resolved": false,
      "previously_flagged": "boolean — true if this issue
                             appeared in a previous review"
    }
  ],

  "blocking_count": "integer — must match count of BLOCKING
                     issues in array exactly",

  "non_blocking_count": "integer — must match count of
                          NON_BLOCKING issues in array exactly",

  "acceptance_criteria_coverage": [
    {
      "label": "string — AC label e.g. AC-1",
      "status": "IMPLEMENTED | NOT_IMPLEMENTED | PARTIAL",
      "note": "string or null — only if PARTIAL or
               NOT_IMPLEMENTED, reference the issue"
    }
  ],

  "resolved_from_previous": [
    "string — AC label or issue title that was in previous
     review but is now resolved"
  ],

  "github_comment": "string — the full formatted markdown
                     comment as described above",

  "generated_by": "string — model name used for this review"
}

Rules:
- issues array can be empty — that is valid
- blocking_count must exactly match BLOCKING issues in array
- non_blocking_count must exactly match NON_BLOCKING issues
- resolved_from_previous is empty array on first review
- Every field is required
- Do not add fields not listed above
- is_resolved is always false in output — Alfred never
  marks its own issues as resolved`;

interface ReviewIssueOut {
  title: string;
  description: string;
  severity: "BLOCKING" | "NON_BLOCKING";
  file_path: string | null;
  line_number: number | null;
  prd_requirement_violated: string;
  suggested_fix: string;
  is_resolved: false;
  previously_flagged: boolean;
}

interface ReviewResultOut {
  summary: string;
  issues: ReviewIssueOut[];
  blocking_count: number;
  non_blocking_count: number;
  acceptance_criteria_coverage: { label: string; status: string; note: string | null }[];
  resolved_from_previous: string[];
  github_comment: string;
  generated_by: string;
}

interface ReviewGuardrailError {
  error: "no_diff" | "no_prd";
  reason: string;
}

function isGuardrailError(result: ReviewResultOut | ReviewGuardrailError): result is ReviewGuardrailError {
  return "error" in result;
}

/** Rough token estimate (chars / 4) — good enough for budget enforcement, not billing. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function getMaxDiffLines(): number {
  const raw = process.env.MAX_DIFF_LINES;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 200;
}

function buildAcceptanceCriteriaText(acceptanceCriteria: unknown): string {
  const items = (acceptanceCriteria as string[] | null) ?? [];
  const full = items.map((item, i) => `[AC-${i + 1}] ${item}`).join("\n");

  // Decision 3: PRD content budget is 1,500 tokens — over that, keep as many
  // whole criteria as fit rather than truncating mid-sentence.
  if (estimateTokens(full) <= 1500) return full;

  const maxChars = 1500 * 4;
  return full.slice(0, maxChars).split("\n").slice(0, -1).join("\n");
}

function chunkDiff(diff: string, linesPerChunk = 40): string[] {
  const lines = diff.split("\n");
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    chunks.push(lines.slice(i, i + linesPerChunk).join("\n"));
  }
  return chunks;
}

interface DiffSection {
  text: string;
  isLargePR: boolean;
}

/** Decision 2: under threshold sends the raw diff; over threshold embeds chunks and keeps only the top 5 most relevant to the PRD's acceptance criteria. Embeddings here are in-memory only — never persisted. */
async function selectDiffSection(diff: string, acceptanceCriteriaText: string): Promise<DiffSection> {
  const maxLines = getMaxDiffLines();
  const lineCount = diff.split("\n").length;

  if (lineCount <= maxLines) {
    return { text: diff, isLargePR: false };
  }

  const chunks = chunkDiff(diff);
  const [queryEmbedding, ...chunkEmbeddings] = await embedTexts([acceptanceCriteriaText, ...chunks]);

  const ranked = chunks
    .map((text, i) => ({ text, score: cosineSimilarity(queryEmbedding!, chunkEmbeddings[i]!) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return { text: ranked.map((c) => c.text).join("\n\n---\n\n"), isLargePR: true };
}

/** Decision 3: task budget is 800 tokens — over that, titles only. */
function buildTasksText(taskRows: (typeof tasks.$inferSelect)[]): string {
  const full = taskRows.map((t) => `- ${t.title}: ${t.description ?? ""}`).join("\n");
  if (estimateTokens(full) <= 800) return full;
  return taskRows.map((t) => `- ${t.title}`).join("\n");
}

/** Decision 3: codebase context budget is 1,500 tokens — over that, drop from top 5 chunks to top 3. */
async function getCodebaseContext(repositoryId: string, queryEmbedding: number[]): Promise<string> {
  async function fetchTopChunks(limit: number) {
    const vectorLiteral = `[${queryEmbedding.join(",")}]`;
    return db
      .select({ filePath: codeChunks.filePath, content: codeChunks.content })
      .from(codeChunks)
      .where(eq(codeChunks.repositoryId, repositoryId))
      .orderBy(sql`${codeChunks.embedding} <=> ${vectorLiteral}::vector`)
      .limit(limit);
  }

  const top5 = await fetchTopChunks(5);
  const format = (rows: { filePath: string; content: string }[]) =>
    rows.map((r) => `File: ${r.filePath}\n${r.content}`).join("\n\n---\n\n");

  const full = format(top5);
  if (estimateTokens(full) <= 1500) return full;

  const top3 = await fetchTopChunks(3);
  return format(top3);
}

function formatPreviousIssues(
  previousReview: typeof aiReviews.$inferSelect | undefined,
  previousIssues: (typeof reviewIssues.$inferSelect)[],
): string {
  if (!previousReview || previousIssues.length === 0) return "";

  return previousIssues
    .map(
      (issue) =>
        `Review #${previousReview.reviewNumber} — [${issue.severity}] ${issue.title}: ${issue.description ?? ""} (${issue.prdRequirementViolated ?? "General best practice"})`,
    )
    .join("\n");
}

interface PerformReviewParams {
  featureId: string;
  pullRequestId: string;
  workflowType: "ai_review" | "re_review";
}

interface PerformReviewResult {
  status: string;
  reason?: string;
  reviewNumber?: number;
}

export async function performReview(run: StepRun, params: PerformReviewParams): Promise<PerformReviewResult> {
  const { featureId, pullRequestId, workflowType } = params;

  const context = await run("fetch-review-context", async () => {
    const [feature] = await db.select().from(features).where(eq(features.id, featureId)).limit(1);
    const [pr] = await db.select().from(pullRequests).where(eq(pullRequests.id, pullRequestId)).limit(1);
    if (!feature || !pr) return null;

    const [repository] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, pr.repositoryId))
      .limit(1);
    const [prd] = await db.select().from(prds).where(eq(prds.featureId, featureId)).limit(1);
    const taskRows = await db.select().from(tasks).where(eq(tasks.featureId, featureId));

    const [previousReview] = await db
      .select()
      .from(aiReviews)
      .where(and(eq(aiReviews.featureId, featureId), eq(aiReviews.isArchived, false)))
      .orderBy(desc(aiReviews.reviewNumber))
      .limit(1);

    const previousIssues = previousReview
      ? await db
          .select()
          .from(reviewIssues)
          .where(
            and(
              eq(reviewIssues.reviewId, previousReview.id),
              eq(reviewIssues.severity, "BLOCKING"),
              eq(reviewIssues.isResolved, false),
            ),
          )
      : [];

    return { feature, pr, repository, prd, taskRows, previousReview, previousIssues };
  });

  if (!context || !context.repository) {
    return { status: "skipped", reason: "missing-context" };
  }

  const { feature, pr, repository, prd, taskRows, previousReview, previousIssues } = context;

  await run("report-progress-running", async () => {
    await reportWorkflowProgress(featureId, workflowType, {
      status: "running",
      progressMessage: "Alfred is reviewing your PR...",
      progressPercent: 20,
      scheduledAt: null,
    });
  });

  if (!prd) {
    await run("save-no-prd-rejection", async () => {
      await reportWorkflowProgress(featureId, workflowType, {
        status: "failed",
        progressMessage: "Review blocked — no PRD found",
        progressPercent: 100,
        errorMessage: "No PRD acceptance criteria were provided for review",
      });
    });
    return { status: "blocked", reason: "no_prd" };
  }

  const reviewNumber = (previousReview?.reviewNumber ?? 0) + 1;
  const acceptanceCriteriaText = buildAcceptanceCriteriaText(prd.acceptanceCriteria);

  const { diffSection, queryEmbedding } = await run("prepare-diff-and-embedding", async () => {
    const diff = pr.diff ?? "";
    const [section, [queryEmbedding]] = await Promise.all([
      selectDiffSection(diff, acceptanceCriteriaText),
      embedTexts([acceptanceCriteriaText]),
    ]);
    return { diffSection: section, queryEmbedding: queryEmbedding! };
  });

  const codebaseContext = await run("fetch-codebase-context", async () => {
    return getCodebaseContext(repository.id, queryEmbedding);
  });

  await run("report-progress-calling-model", async () => {
    await reportWorkflowProgress(featureId, workflowType, { progressPercent: 60 });
  });

  const result = await run("call-claude-for-review", async () => {
    const prompt = AI_REVIEW_SYSTEM_PROMPT.replaceAll("{{REVIEW_NUMBER}}", String(reviewNumber))
      .replace("{{FEATURE_TITLE}}", feature.title)
      .replace("{{ACCEPTANCE_CRITERIA}}", acceptanceCriteriaText)
      .replace("{{TASKS}}", buildTasksText(taskRows))
      .replace("{{PR_DIFF}}", diffSection.text || "")
      .replace("{{CODEBASE_CONTEXT}}", codebaseContext)
      .replace("{{PREVIOUS_REVIEW_ISSUES}}", formatPreviousIssues(previousReview, previousIssues))
      .replace(
        "{{LARGE_PR_NOTICE}}",
        diffSection.isLargePR ? "This PR's diff exceeded the review size threshold." : "",
      );

    return chatCompleteJSON<ReviewResultOut | ReviewGuardrailError>([{ role: "system", content: prompt }]);
  });

  if (isGuardrailError(result)) {
    await run("save-guardrail-rejection", async () => {
      await reportWorkflowProgress(featureId, workflowType, {
        status: "failed",
        progressMessage: "Review blocked",
        progressPercent: 100,
        errorMessage: result.reason,
      });

      await db.insert(notifications).values({
        userId: feature.createdBy,
        workspaceId: feature.workspaceId,
        type: "review_blocked",
        title: "AI review blocked",
        message: result.reason,
        featureId,
      });
    });
    return { status: "blocked", reason: result.error };
  }

  const savedReview = await run("save-review-and-issues", async () => {
    // Decision 6: edit the existing PR comment on re-review instead of creating a new one.
    const existingCommentId = previousReview?.githubCommentId ?? null;

    const [saved] = await db
      .insert(aiReviews)
      .values({
        featureId,
        pullRequestId,
        reviewNumber,
        status: result.blocking_count > 0 ? "FAILED" : "PASSED",
        summary: result.summary,
        blockingCount: result.blocking_count,
        nonBlockingCount: result.non_blocking_count,
        modelUsed: result.generated_by || getLLMModel(),
        isLargePR: diffSection.isLargePR,
        resolvedFromPrevious: result.resolved_from_previous,
        criteriaCoverage: result.acceptance_criteria_coverage,
      })
      .returning();

    if (!saved) throw new Error("Failed to save AI review");

    if (result.issues.length > 0) {
      await db.insert(reviewIssues).values(
        result.issues.map((issue) => ({
          reviewId: saved.id,
          title: issue.title,
          description: issue.description,
          severity: issue.severity,
          filePath: issue.file_path,
          lineNumber: issue.line_number,
          prdRequirementViolated: issue.prd_requirement_violated,
          suggestedFix: issue.suggested_fix,
          isResolved: false,
          carriedOverFromReviewNumber: issue.previously_flagged ? (previousReview?.reviewNumber ?? null) : null,
        })),
      );
    }

    // Decision 5: previous BLOCKING issues not re-flagged this round are resolved.
    if (previousIssues.length > 0) {
      const stillPresentTitles = new Set(
        result.issues.filter((i) => i.previously_flagged).map((i) => i.title.toLowerCase()),
      );
      const resolvedIssueIds = previousIssues
        .filter((issue) => !stillPresentTitles.has(issue.title.toLowerCase()))
        .map((issue) => issue.id);

      for (const issueId of resolvedIssueIds) {
        await db
          .update(reviewIssues)
          .set({ isResolved: true, resolvedAt: new Date() })
          .where(eq(reviewIssues.id, issueId));
      }
    }

    return { ...saved, existingCommentId };
  });

  await run("post-github-comment", async () => {
    try {
      const [owner, name] = repository.fullName.split("/");
      if (!owner || !name || !pr.githubPrNumber) return;

      const commentId = await upsertPullRequestComment(
        repository.installationId,
        owner,
        name,
        pr.githubPrNumber,
        result.github_comment,
        savedReview.existingCommentId,
      );

      await db.update(aiReviews).set({ githubCommentId: commentId }).where(eq(aiReviews.id, savedReview.id));
    } catch (error) {
      // Decision 6: comment posting failures never fail the review — it's already saved to the DB.
      console.error("Failed to post GitHub PR review comment", error);
    }
  });

  await run("finalize-feature-status-and-notify", async () => {
    const newStatus = result.blocking_count > 0 ? "CHANGES_REQUESTED" : "REVIEW_PASSED";

    await db.update(features).set({ status: newStatus, updatedAt: new Date() }).where(eq(features.id, featureId));

    await db.insert(notifications).values({
      userId: feature.createdBy,
      workspaceId: feature.workspaceId,
      type: "review_complete",
      title: result.blocking_count > 0 ? "Review found blocking issues" : "Review passed",
      message: result.summary,
      featureId,
    });

    await reportWorkflowProgress(featureId, workflowType, {
      status: "completed",
      progressMessage: "Review complete",
      progressPercent: 100,
    });
  });

  return { status: "reviewed", reviewNumber };
}
