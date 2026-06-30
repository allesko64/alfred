import {
  chatCompleteJSON,
  cosineSimilarity,
  embedTexts,
  getLLMModel,
  getPullRequestWithDiff,
  upsertPullRequestComment,
} from "@alfred/ai";
import {
  aiReviews,
  checkAndDeductCredits,
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
import {
  type ReviewIssueOut,
  type ReviewResultOut,
  reviewResultOutSchema,
} from "@alfred/validators";
import { and, desc, eq, sql } from "drizzle-orm";
import { inngest } from "../client";
import { reportWorkflowProgress } from "../workflow-runs";

/** Inngest's `step.run` signature, decoupled from Inngest's own types so this core can be shared by multiple `createFunction` handlers. */
export type StepRun = <T>(id: string, fn: () => Promise<T>) => Promise<T>;

const AI_REVIEW_SYSTEM_PROMPT = `You are Alfred, an AI-powered software delivery co-pilot. You are
reviewing a pull request to check whether the code actually does
what the PRD asked for.

Think like a senior engineer doing a real code review — not a
linter, not a compliance checker. You read the diff, understand
what changed and why, compare it against what was promised, and
say what you actually think. Be direct. Be useful. Be human about it.

---

YOUR CONTEXT

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

HOW TO READ THE DIFF

Read every changed file and understand how the edits connect to
each other before judging any single line in isolation.

Compare what changed against what it's supposed to accomplish.
A function can look fine on its own and still fail to satisfy
the acceptance criteria it was meant to address.

Trace the logic. When the diff adds a conditional, walk through
each branch, including the one nobody tested.

Notice what's missing as much as what's there. The most important
issue is often the thing the diff forgot to do — a validation
that never got added, a state that never got handled.

Use the codebase context to understand existing conventions.
Where similar code already exists elsewhere in the repo, compare
this diff against that established pattern.

When a previous review is provided, read the diff with that
history in mind — confirm whether what was flagged before is
genuinely addressed now, not just whether the file was touched.

Picture the code actually running. If you're not confident it
behaves the way the PRD describes, that uncertainty is itself
worth raising as an issue — see the next section for exactly
how to do that.

---

WHAT COUNTS AS A REAL ISSUE

Flag something when it's a genuine problem with the implementation:

- the code doesn't do what an acceptance criterion requires
- there's a bug — something that will break, behave incorrectly,
  or produce wrong results
- there's a security issue — exposed secrets, missing validation
  on user input, injection risk, auth that can be bypassed
- something the PRD asked for is missing from the diff
- an edge case that will obviously happen in real usage is
  unhandled and would cause a visible problem
- you have a genuine, specific doubt about whether the behavior
  is correct — in that case, write the issue exactly as a doubt:
  describe what's uncertain, why it matters, and what would
  resolve it

Strong reviews are honest reviews. Style preferences, alternative
valid implementations, and things outside this PRD's scope belong
in your own judgment, not the issues list. If the PR genuinely
looks solid, the right outcome is an empty issues array and a
summary that says so plainly.

---

KEEPING THE SUMMARY AND THE ISSUES IN SYNC

The summary is your verdict, and the issues array is the evidence
for that verdict. They should always tell the same story.

Every concern that shapes your verdict needs to exist as an entry
in the issues array — with a file, a fix, or a clear reason
attached. If something is significant enough to mention in the
summary, it's significant enough to be a structured issue too.

This means: a summary that reads as confident and passing pairs
with an issues array that's empty or minor-only. A summary that
expresses real doubt or incompleteness pairs with issues that
spell out exactly what's unresolved. Write the summary as a
direct reflection of what's actually in the issues array — the
two should be readable as the same conclusion from two angles.

---

RATING IMPORTANCE

Each issue gets an importance level, based on judgment rather
than a rigid formula:

- "critical" — this will break something, cause a security
  problem, or means the feature doesn't actually do what it was
  supposed to. Worth fixing before merging.
- "minor" — worth fixing, but the feature still basically works
  without it. Polish, small gaps, things that can follow up later.

Security issues — exposed secrets, injection risks, broken auth,
missing input validation on anything user-controlled — are always
"critical," independent of what the PRD says about them.

When you're genuinely torn between the two, "minor" is the safer
call. Reserve "critical" for when you're confident it actually
matters.

---

CONNECTING ISSUES TO THE PRD

When an issue relates to a specific acceptance criterion, describe
what that criterion actually requires in plain language — write
it the way you'd explain it to a developer who hasn't memorized
the PRD, not as a bare label. For example: "the PRD requires theme
choice to persist across page reloads" rather than a reference
like "AC-5" on its own.

When an issue is a genuine bug or security concern that isn't
tied to a specific criterion, describe it as a general finding
in the same plain-language style.

This same standard applies in the summary too — every reference
to a requirement should be understandable entirely on its own,
without needing to cross-check the PRD separately.

---

RE-REVIEWS

When previous review issues are provided, this is a re-review.

Check the diff against each previous issue to see whether it's
genuinely been addressed, not just whether the relevant file was
touched. Resolved issues drop out of the list entirely — there's
no need to mention that something used to be a problem. Anything
still outstanding gets included again, stated plainly as still
present. New issues found this time are listed alongside whatever
remains from before, at the same standard described above.

---

GROUNDING THE REVIEW

Reference file paths and line numbers exactly as they appear in
the diff you were given. When you can't pin down the precise
location of something, say so honestly rather than estimating.

When the diff was large and you were given only the most relevant
sections, mention that plainly in the summary so the reader knows
the review's coverage.

Stay scoped to this feature and this PRD — that's the lens for
this review, even when other parts of the codebase catch your eye.

If no diff or no PRD criteria were provided, say so honestly as
your summary rather than reviewing nothing.

---

OUTPUT FORMAT

Respond with ONLY a valid JSON object. No markdown, no backticks,
no preamble, no text outside the JSON.

{
  "summary": "string — a few honest sentences on how this PR
              stacks up against the PRD, written like you'd
              actually say it to the developer",

  "issues": [
    {
      "title": "string — short, specific, plain language",
      "description": "string — what's wrong and why it matters",
      "importance": "critical | minor",
      "file_path": "string or null",
      "line_number": "integer or null",
      "related_to": "string — AC label or 'general issue'",
      "suggested_fix": "string — a concrete, specific fix"
    }
  ],

  "generated_by": "string — the model name used"
}

Notes on the output:
- "issues" can be an empty array — that's a good and valid result
- Every issue needs every field; use null only for file_path /
  line_number when truly unknown
- Keep the summary honest and specific, not generic praise or
  generic criticism`;

/** Importance → DB severity column mapping (schema kept as BLOCKING/NON_BLOCKING to avoid a migration). */
const IMPORTANCE_TO_SEVERITY = {
  critical: "BLOCKING",
  minor: "NON_BLOCKING",
} as const;

function criticalIssues(issues: ReviewIssueOut[]): ReviewIssueOut[] {
  return issues.filter((issue) => issue.importance === "critical");
}

/** Builds the GitHub PR comment deterministically in code — the model no longer generates markdown. Only the summary and critical issues are shown. */
function formatGithubComment(
  reviewNumber: number,
  result: ReviewResultOut,
): string {
  const critical = criticalIssues(result.issues);

  const issuesText =
    critical.length === 0
      ? "No critical issues found ✅"
      : critical
          .map((issue, i) => {
            const location = issue.file_path
              ? `\`${issue.file_path}\`${issue.line_number ? ` line ${issue.line_number}` : ""}`
              : "location unknown";
            return `**${i + 1}. ${issue.title}**\n- File: ${location}\n- Related to: ${issue.related_to}\n- Suggested fix: ${issue.suggested_fix}`;
          })
          .join("\n\n");

  return [
    `## Alfred Review #${reviewNumber} 🤖`,
    `### Summary\n${result.summary}`,
    `### 🔴 Critical Issues (${critical.length})\n${issuesText}`,
    `---\n*Reviewed by Alfred — AI Software Delivery Co-pilot*`,
  ].join("\n\n");
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
    const chunk = lines.slice(i, i + linesPerChunk).join("\n");
    if (chunk.trim().length > 0) chunks.push(chunk);
  }
  return chunks;
}

interface DiffSection {
  text: string;
  isLargePR: boolean;
}

/** Decision 2: under threshold sends the raw diff; over threshold embeds chunks and keeps only the top 5 most relevant to the PRD's acceptance criteria. Embeddings here are in-memory only — never persisted. */
async function selectDiffSection(
  diff: string,
  acceptanceCriteriaText: string,
): Promise<DiffSection> {
  const maxLines = getMaxDiffLines();
  const lineCount = diff.split("\n").length;

  if (lineCount <= maxLines) {
    return { text: diff, isLargePR: false };
  }

  const chunks = chunkDiff(diff);
  const [queryEmbedding, ...chunkEmbeddings] = await embedTexts([
    acceptanceCriteriaText,
    ...chunks,
  ]);

  const ranked = chunks
    .map((text, i) => ({
      text,
      score: cosineSimilarity(queryEmbedding!, chunkEmbeddings[i]!),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    text: ranked.map((c) => c.text).join("\n\n---\n\n"),
    isLargePR: true,
  };
}

/** Decision 3: task budget is 800 tokens — over that, titles only. */
function buildTasksText(taskRows: (typeof tasks.$inferSelect)[]): string {
  const full = taskRows
    .map((t) => `- ${t.title}: ${t.description ?? ""}`)
    .join("\n");
  if (estimateTokens(full) <= 800) return full;
  return taskRows.map((t) => `- ${t.title}`).join("\n");
}

/** Decision 3: codebase context budget is 1,500 tokens — over that, drop from top 5 chunks to top 3. */
async function getCodebaseContext(
  repositoryId: string,
  queryEmbedding: number[],
): Promise<string> {
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
        `Review #${previousReview.reviewNumber} — [critical] ${issue.title}: ${issue.description ?? ""} (${issue.prdRequirementViolated ?? "general issue"})`,
    )
    .join("\n");
}

interface PerformReviewParams {
  featureId: string;
  pullRequestId: string;
  workflowType: "ai_review" | "re_review";
  inngestRunId?: string;
}

interface PerformReviewResult {
  status: string;
  reason?: string;
  reviewNumber?: number;
}

export async function performReview(
  run: StepRun,
  params: PerformReviewParams,
): Promise<PerformReviewResult> {
  const { featureId, pullRequestId, workflowType } = params;

  await reportWorkflowProgress(featureId, workflowType, {
    inngestRunId: params.inngestRunId,
    status: "running",
    progressMessage: "Fetching review context...",
    progressPercent: 5,
  });

  const context = await run("fetch-review-context", async () => {
    const [feature] = await db
      .select()
      .from(features)
      .where(eq(features.id, featureId))
      .limit(1);
    const [pr] = await db
      .select()
      .from(pullRequests)
      .where(eq(pullRequests.id, pullRequestId))
      .limit(1);
    if (!feature || !pr) return null;

    const [repository] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, pr.repositoryId))
      .limit(1);
    const [prd] = await db
      .select()
      .from(prds)
      .where(eq(prds.featureId, featureId))
      .limit(1);
    const taskRows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.featureId, featureId));

    const [previousReview] = await db
      .select()
      .from(aiReviews)
      .where(
        and(
          eq(aiReviews.featureId, featureId),
          eq(aiReviews.isArchived, false),
        ),
      )
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

    return {
      feature,
      pr,
      repository,
      prd,
      taskRows,
      previousReview,
      previousIssues,
    };
  });

  if (!context || !context.repository) {
    return { status: "skipped", reason: "missing-context" };
  }

  const {
    feature,
    pr,
    repository,
    prd,
    taskRows,
    previousReview,
    previousIssues,
  } = context;

  await run("report-progress-running", async () => {
    await reportWorkflowProgress(featureId, workflowType, {
      inngestRunId: params.inngestRunId,
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

  const credits = await run("check-and-deduct-credits", async () =>
    checkAndDeductCredits(
      feature.workspaceId,
      workflowType === "re_review" ? "re_review" : "ai_review",
    ),
  );

  if (!credits.allowed) {
    await run("save-billing-block", async () => {
      await reportWorkflowProgress(featureId, workflowType, {
        status: "failed",
        progressMessage: "Review blocked — out of AI credits",
        progressPercent: 100,
        errorMessage:
          "Out of AI credits. Upgrade or wait for your next monthly reset.",
      });

      await db.insert(notifications).values({
        userId: feature.createdBy,
        workspaceId: feature.workspaceId,
        type: "review_blocked",
        title: "AI review blocked",
        message:
          "Out of AI credits. Upgrade or wait for your next monthly reset.",
        featureId,
      });
    });
    return { status: "blocked", reason: "billing_limit" };
  }

  const reviewNumber = (previousReview?.reviewNumber ?? 0) + 1;
  const acceptanceCriteriaText = buildAcceptanceCriteriaText(
    prd.acceptanceCriteria,
  );

  await run("report-progress-fetching-diff", async () => {
    await reportWorkflowProgress(featureId, workflowType, {
      progressPercent: 30,
      progressMessage: "Fetching latest PR diff...",
    });
  });

  const { diffSection, queryEmbedding } = await run(
    "prepare-diff-and-embedding",
    async () => {
      // Item 9.2 / 23: the cached `pull_requests.diff` column can be stale —
      // re-fetch the diff fresh from GitHub at review time so the review is
      // always graded against the PR's current state, not whatever was last
      // ingested. The fresh diff is written back to the DB column so other
      // readers (UI, future re-reviews before the next webhook) still see it.
      let diff = pr.diff ?? "";
      const [owner, name] = repository.fullName.split("/");
      if (owner && name && pr.githubPrNumber) {
        try {
          const fresh = await getPullRequestWithDiff(
            repository.installationId,
            repository.owner ?? owner,
            repository.name ?? name,
            pr.githubPrNumber,
          );
          diff = fresh.diff ?? diff;

          await db
            .update(pullRequests)
            .set({ diff, updatedAt: new Date() })
            .where(eq(pullRequests.id, pullRequestId));
        } catch (error) {
          // Fall back to the cached diff rather than failing the whole review
          // if GitHub is temporarily unreachable.
          console.error("Failed to re-fetch fresh PR diff, using cached diff", error);
        }
      }

      const [section, [queryEmbedding]] = await Promise.all([
        selectDiffSection(diff, acceptanceCriteriaText),
        embedTexts([acceptanceCriteriaText]),
      ]);
      return { diffSection: section, queryEmbedding: queryEmbedding! };
    },
  );

  if (!diffSection.text) {
    await run("save-no-diff-rejection", async () => {
      await reportWorkflowProgress(featureId, workflowType, {
        status: "failed",
        progressMessage: "Review blocked — no PR diff found",
        progressPercent: 100,
        errorMessage: "No PR diff was provided for review",
      });
    });
    return { status: "blocked", reason: "no_diff" };
  }

  const codebaseContext = await run("fetch-codebase-context", async () => {
    return getCodebaseContext(repository.id, queryEmbedding);
  });

  await run("report-progress-calling-model", async () => {
    await reportWorkflowProgress(featureId, workflowType, {
      progressPercent: 60,
    });
  });

  const result = await run("call-claude-for-review", async () => {
    const prompt = AI_REVIEW_SYSTEM_PROMPT.replace(
      "{{FEATURE_TITLE}}",
      feature.title,
    )
      .replace("{{ACCEPTANCE_CRITERIA}}", acceptanceCriteriaText)
      .replace("{{TASKS}}", buildTasksText(taskRows))
      .replace("{{PR_DIFF}}", diffSection.text || "")
      .replace("{{CODEBASE_CONTEXT}}", codebaseContext)
      .replace(
        "{{PREVIOUS_REVIEW_ISSUES}}",
        formatPreviousIssues(previousReview, previousIssues),
      )
      .replace(
        "{{LARGE_PR_NOTICE}}",
        diffSection.isLargePR
          ? "This PR's diff exceeded the review size threshold."
          : "",
      );

    const { data: raw, tokensUsed } = await chatCompleteJSON<unknown>([
      { role: "system", content: prompt },
    ]);
    const parsed = reviewResultOutSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `AI review response did not match expected structure: ${parsed.error.message}`,
      );
    }
    return { ...parsed.data, tokensUsed };
  });

  const critical = criticalIssues(result.issues);
  const minorCount = result.issues.length - critical.length;
  const githubComment = formatGithubComment(reviewNumber, result);

  await run("report-progress-saving-review", async () => {
    await reportWorkflowProgress(featureId, workflowType, {
      progressPercent: 85,
      progressMessage: "Saving review results...",
    });
  });

  const savedReview = await run("save-review-and-issues", async () => {
    // Decision 6: edit the existing PR comment on re-review instead of creating a new one.
    const existingCommentId = previousReview?.githubCommentId ?? null;

    const [saved] = await db
      .insert(aiReviews)
      .values({
        featureId,
        pullRequestId,
        reviewNumber,
        status: critical.length > 0 ? "FAILED" : "PASSED",
        summary: result.summary,
        blockingCount: critical.length,
        nonBlockingCount: minorCount,
        modelUsed: result.generated_by || getLLMModel(),
        tokensUsed: result.tokensUsed,
        isLargePR: diffSection.isLargePR,
      })
      .returning();

    if (!saved) throw new Error("Failed to save AI review");

    const previousTitles = new Set(
      previousIssues.map((issue) => issue.title.toLowerCase()),
    );

    if (result.issues.length > 0) {
      await db.insert(reviewIssues).values(
        result.issues.map((issue) => ({
          reviewId: saved.id,
          title: issue.title,
          description: issue.description,
          severity: IMPORTANCE_TO_SEVERITY[issue.importance],
          filePath: issue.file_path,
          lineNumber: issue.line_number,
          prdRequirementViolated: issue.related_to,
          suggestedFix: issue.suggested_fix,
          isResolved: false,
          carriedOverFromReviewNumber: previousTitles.has(
            issue.title.toLowerCase(),
          )
            ? (previousReview?.reviewNumber ?? null)
            : null,
        })),
      );
    }

    // Decision 5: previous critical issues not re-flagged this round are resolved.
    if (previousIssues.length > 0) {
      const stillPresentTitles = new Set(
        critical.map((issue) => issue.title.toLowerCase()),
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

  await run("report-progress-posting-comment", async () => {
    await reportWorkflowProgress(featureId, workflowType, {
      progressPercent: 95,
      progressMessage: "Posting review comment to GitHub...",
    });
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
        githubComment,
        savedReview.existingCommentId,
      );

      await db
        .update(aiReviews)
        .set({ githubCommentId: commentId })
        .where(eq(aiReviews.id, savedReview.id));
    } catch (error) {
      // Decision 6: comment posting failures never fail the review — it's already saved to the DB.
      console.error("Failed to post GitHub PR review comment", error);
    }
  });

  await run("finalize-feature-status-and-notify", async () => {
    const newStatus =
      critical.length > 0 ? "CHANGES_REQUESTED" : "REVIEW_PASSED";

    await db
      .update(features)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(features.id, featureId));

    await db.insert(notifications).values({
      userId: feature.createdBy,
      workspaceId: feature.workspaceId,
      type: "review_complete",
      title:
        critical.length > 0 ? "Review found critical issues" : "Review passed",
      message: result.summary,
      featureId,
    });

    await reportWorkflowProgress(featureId, workflowType, {
      status: "completed",
      progressMessage: "Review complete",
      progressPercent: 100,
    });
  });

  if (critical.length === 0) {
    await run("trigger-release-readiness-check", async () => {
      await inngest.send({
        name: "feature/release-readiness.requested",
        data: { featureId },
      });
    });
  }

  return { status: "reviewed", reviewNumber };
}
