"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  CheckCircleIcon,
  GitPullRequestIcon,
  RocketLaunchIcon,
  SpinnerIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/workspace/dashboard/status-dot"
import { AlfredAvatar } from "@/components/workspace/conversation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PRE_DEVELOPMENT_STATUSES = new Set([
  "DRAFT",
  "CLARIFYING",
  "PRD_GENERATION",
  "PRD_READY",
  "TASK_GENERATION",
  "PLANNING",
])

type ReviewIssue = {
  id: string
  title: string
  description: string | null
  severity: "BLOCKING" | "NON_BLOCKING"
  filePath: string | null
  lineNumber: number | null
  prdRequirementViolated: string | null
  suggestedFix: string | null
  carriedOverFromReviewNumber: number | null
}

type Review = {
  id: string
  reviewNumber: number
  status: string
  summary: string | null
  blockingCount: number
  nonBlockingCount: number
  isLargePR: boolean
  isArchived: boolean
  resolvedFromPrevious: unknown
  criteriaCoverage: unknown
  createdAt: Date
  issues: ReviewIssue[]
}

function IssueCard({ issue }: { issue: ReviewIssue }) {
  const isBlocking = issue.severity === "BLOCKING"
  return (
    <div
      className={
        isBlocking
          ? "flex flex-col gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3"
          : "flex flex-col gap-1 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className={isBlocking ? "text-sm font-medium text-destructive" : "text-sm font-medium text-warning"}>
          {issue.title}
        </span>
        {issue.carriedOverFromReviewNumber && (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            Previously flagged in Review #{issue.carriedOverFromReviewNumber} — still present
          </Badge>
        )}
      </div>
      {issue.description && <span className="text-sm text-muted-foreground">{issue.description}</span>}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
        {issue.filePath && (
          <span>
            <code>{issue.filePath}</code>
            {issue.lineNumber ? ` line ${issue.lineNumber}` : ""}
          </span>
        )}
        {issue.prdRequirementViolated && <span>Requirement: {issue.prdRequirementViolated}</span>}
        {issue.suggestedFix && <span>Fix: {issue.suggestedFix}</span>}
      </div>
    </div>
  )
}

function ReviewResults({
  review,
  workspaceId,
  featureId,
}: {
  review: Review
  workspaceId: string
  featureId: string
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()

  const requestReviewNow = useMutation(
    trpc.github.requestReviewNow.mutationOptions({
      onSuccess: () => {
        toast.success("Re-review started")
        queryClient.invalidateQueries({ queryKey: trpc.review.getWorkflowStatus.queryKey({ workspaceId, featureId }) })
      },
      onError: (error) => toast.error(error.message || "Could not start the re-review"),
    }),
  )

  const blockingIssues = review.issues.filter((i) => i.severity === "BLOCKING")
  const nonBlockingIssues = review.issues.filter((i) => i.severity === "NON_BLOCKING")
  const resolvedFromPrevious = (review.resolvedFromPrevious as string[] | null) ?? []
  const criteriaCoverage = (review.criteriaCoverage as { label: string; status: string; note: string | null }[] | null) ?? []
  const canShip = review.blockingCount === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Review #{review.reviewNumber}</span>
          {review.isLargePR && (
            <Badge variant="outline" className="text-muted-foreground">
              Large PR detected — Alfred focused on the most relevant sections
            </Badge>
          )}
        </div>
        {canShip ? (
          <Button
            size="sm"
            onClick={() => router.push(`/workspace/${workspaceId}/features/${featureId}/approval`)}
          >
            <RocketLaunchIcon />
            Approve &amp; Ship
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={requestReviewNow.isPending}
            onClick={() => requestReviewNow.mutate({ workspaceId, featureId })}
          >
            {requestReviewNow.isPending && <SpinnerIcon className="size-3.5 animate-spin" />}
            Request Re-review
          </Button>
        )}
      </div>

      {resolvedFromPrevious.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3">
          <CheckCircleIcon weight="fill" className="mt-0.5 size-4 shrink-0 text-success" />
          <span className="text-sm text-success">
            {resolvedFromPrevious.length} issue{resolvedFromPrevious.length > 1 ? "s" : ""} resolved since the
            previous review
          </span>
        </div>
      )}

      {review.summary && <p className="text-lg text-foreground">{review.summary}</p>}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-destructive">
          🔴 Blocking Issues ({blockingIssues.length})
        </span>
        {blockingIssues.length === 0 ? (
          <span className="text-sm text-muted-foreground">No blocking issues found ✅</span>
        ) : (
          blockingIssues.map((issue) => <IssueCard key={issue.id} issue={issue} />)
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-warning">
          🟡 Non-Blocking Issues ({nonBlockingIssues.length})
        </span>
        {nonBlockingIssues.length === 0 ? (
          <span className="text-sm text-muted-foreground">No non-blocking issues found ✅</span>
        ) : (
          nonBlockingIssues.map((issue) => <IssueCard key={issue.id} issue={issue} />)
        )}
      </div>

      {criteriaCoverage.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border px-4 py-3">
          <span className="text-sm font-medium text-foreground">Acceptance criteria coverage</span>
          {criteriaCoverage.map((ac) => (
            <div key={ac.label} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {ac.status === "IMPLEMENTED" ? "✅" : ac.status === "PARTIAL" ? "⚠️" : "❌"} {ac.label}
              </span>
              {ac.note && <span className="text-muted-foreground/70">— {ac.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ReviewClient() {
  const { workspaceId, featureId } = useParams<{ workspaceId: string; featureId: string }>()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [isLinking, setIsLinking] = useState(false)
  const [selectedPRId, setSelectedPRId] = useState<string | null>(null)

  const featureQuery = useQuery(trpc.feature.getById.queryOptions({ workspaceId, featureId }))
  const linkedPRQuery = useQuery(trpc.github.getLinkedPullRequest.queryOptions({ workspaceId, featureId }))
  const unlinkedPRsQuery = useQuery({
    ...trpc.github.listUnlinkedPullRequests.queryOptions({ workspaceId }),
    enabled: isLinking,
  })

  const feature = featureQuery.data
  const pr = linkedPRQuery.data
  const isPreDevelopment = !!feature && PRE_DEVELOPMENT_STATUSES.has(feature.status)

  const workflowStatusQuery = useQuery(
    trpc.review.getWorkflowStatus.queryOptions(
      { workspaceId, featureId },
      { enabled: !!pr, refetchInterval: pr ? 2000 : false },
    ),
  )
  const historyQuery = useQuery(trpc.review.getByFeature.queryOptions({ workspaceId, featureId }, { enabled: !!pr }))

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: trpc.github.getLinkedPullRequest.queryKey({ workspaceId, featureId }) })
    queryClient.invalidateQueries({ queryKey: trpc.github.listUnlinkedPullRequests.queryKey({ workspaceId }) })
    queryClient.invalidateQueries({ queryKey: trpc.feature.getById.queryKey({ workspaceId, featureId }) })
    queryClient.invalidateQueries({ queryKey: trpc.review.getWorkflowStatus.queryKey({ workspaceId, featureId }) })
    queryClient.invalidateQueries({ queryKey: trpc.review.getByFeature.queryKey({ workspaceId, featureId }) })
  }

  const linkPullRequest = useMutation(
    trpc.github.linkPullRequest.mutationOptions({
      onSuccess: () => {
        toast.success("PR linked")
        setSelectedPRId(null)
        setIsLinking(false)
        invalidateAll()
      },
      onError: (error) => toast.error(error.message || "Could not link this PR"),
    }),
  )

  const unlinkPullRequest = useMutation(
    trpc.github.unlinkPullRequest.mutationOptions({
      onSuccess: () => {
        toast.success("PR unlinked")
        invalidateAll()
      },
    }),
  )

  const requestReviewNow = useMutation(
    trpc.github.requestReviewNow.mutationOptions({
      onSuccess: () => {
        toast.success("Review starting now")
        queryClient.invalidateQueries({ queryKey: trpc.review.getWorkflowStatus.queryKey({ workspaceId, featureId }) })
      },
    }),
  )

  if (featureQuery.isLoading || linkedPRQuery.isLoading) {
    return <div className="max-w-[700px] py-16" />
  }

  // State 1 — feature isn't in development yet, so there's nothing to review.
  if (isPreDevelopment) {
    return (
      <div className="flex max-w-[700px] flex-col items-center gap-1 py-16 text-center">
        <span className="text-sm font-medium text-muted-foreground">Review</span>
        <span className="text-sm text-muted-foreground/70">
          Complete your tasks first before linking a PR for review
        </span>
      </div>
    )
  }

  const unlinkedPRs = unlinkedPRsQuery.data ?? []

  // State 2 — in development, nothing linked yet.
  if (!pr) {
    return (
      <div className="flex max-w-[700px] flex-col items-center gap-4 py-16 text-center">
        <AlfredAvatar />
        <span className="text-sm font-medium text-foreground">Link a pull request to start the AI review</span>

        {!isLinking ? (
          <Button onClick={() => setIsLinking(true)}>Link PR</Button>
        ) : (
          <div className="flex w-full items-center gap-2">
            <Select value={selectedPRId} onValueChange={setSelectedPRId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose an open PR" />
              </SelectTrigger>
              <SelectContent>
                {unlinkedPRs.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">No unlinked open PRs</div>
                ) : (
                  unlinkedPRs.map((unlinked) => (
                    <SelectItem key={unlinked.id} value={unlinked.id}>
                      #{unlinked.githubPrNumber} {unlinked.title} · {unlinked.repositoryName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              disabled={!selectedPRId || linkPullRequest.isPending}
              onClick={() =>
                selectedPRId && linkPullRequest.mutate({ workspaceId, featureId, pullRequestId: selectedPRId })
              }
            >
              {linkPullRequest.isPending && <SpinnerIcon className="size-4 animate-spin" />}
              Link
            </Button>
          </div>
        )}
      </div>
    )
  }

  const workflowStatus = workflowStatusQuery.data
  const isPending = workflowStatus?.status === "pending"
  const reviews = (historyQuery.data?.reviews ?? []) as Review[]
  const currentReviews = reviews.filter((r) => !r.isArchived)
  const latestReview = currentReviews[0] ?? null
  const isRunning = workflowStatus?.status === "running" || (!latestReview && workflowStatus?.status !== "failed")

  return (
    <div className="flex max-w-[700px] flex-col gap-6 py-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 truncate">
              <GitPullRequestIcon className="size-4 shrink-0 text-muted-foreground" />
              <a
                href={pr.htmlUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:underline"
              >
                #{pr.githubPrNumber} {pr.title}
              </a>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              onClick={() => unlinkPullRequest.mutate({ workspaceId, pullRequestId: pr.id })}
              disabled={unlinkPullRequest.isPending}
            >
              {unlinkPullRequest.isPending && <SpinnerIcon className="size-3.5 animate-spin" />}
              Unlink PR
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{pr.repositoryName}</span>
          <StatusBadge status={pr.status} />
        </CardContent>
      </Card>

      {/* Decision 1 — debounce banner takes priority over the generic running state. */}
      {isPending && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <span className="text-sm text-muted-foreground">{workflowStatus?.progressMessage}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={requestReviewNow.isPending}
            onClick={() => requestReviewNow.mutate({ workspaceId, featureId })}
          >
            {requestReviewNow.isPending && <SpinnerIcon className="size-3.5 animate-spin" />}
            Review now
          </Button>
        </div>
      )}

      {!isPending && isRunning && (
        <div className="flex w-full items-center gap-4 rounded-lg bg-muted px-4 py-4">
          <AlfredAvatar pulse />
          <div className="flex flex-1 flex-col gap-2">
            <span className="text-sm text-foreground">
              {workflowStatus?.progressMessage ?? "Alfred is reviewing your PR..."}
            </span>
            <Progress value={workflowStatus?.progressPercent ?? 20} />
          </div>
        </div>
      )}

      {workflowStatus?.status === "failed" && !latestReview && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-4">
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-destructive">Review couldn&apos;t run</span>
            <span className="text-sm text-muted-foreground">{workflowStatus.errorMessage}</span>
          </div>
        </div>
      )}

      {!isPending && !isRunning && latestReview && (
        <>
          <ReviewResults review={latestReview} workspaceId={workspaceId} featureId={featureId} />

          {currentReviews.length > 1 && (
            <details className="rounded-lg border border-border px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                Previous reviews ({currentReviews.length - 1})
              </summary>
              <div className="mt-3 flex flex-col gap-4">
                {currentReviews.slice(1).map((review) => (
                  <ReviewResults key={review.id} review={review} workspaceId={workspaceId} featureId={featureId} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
