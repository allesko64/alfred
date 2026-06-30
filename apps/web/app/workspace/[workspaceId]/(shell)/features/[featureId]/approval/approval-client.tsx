"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import confetti from "canvas-confetti"
import { PRE_REVIEW_STATUSES } from "@alfred/db/feature-status-groups"
import {
  CaretRightIcon,
  CheckCircleIcon,
  CircleIcon,
  GitPullRequestIcon,
  RocketLaunchIcon,
  SpinnerIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Button as StatefulButton } from "@/components/ui/stateful-button"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { StatusBadge } from "@/components/workspace/dashboard/status-dot"
import { AlfredAvatar } from "@/components/workspace/conversation"
import { useSetFeatureHeaderAction } from "@/components/workspace/feature-detail/feature-header-actions"
import { ApprovalGate } from "@/components/workspace/feature-detail/approval-gate"
import {
  IssueCard,
  IssueGroupHeader,
  EmptyIssueState,
  type Review,
} from "@/components/workspace/feature-detail/review-issue-card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const PRE_REVIEW_STATUS_SET = new Set<string>(PRE_REVIEW_STATUSES)

type ChecklistState = "done" | "blocking" | "pending"

function ChecklistRow({
  label,
  state,
  detail,
}: {
  label: string
  state: ChecklistState
  detail?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm">
        {state === "done" && <CheckCircleIcon weight="fill" className="size-4 shrink-0 text-success" />}
        {state === "blocking" && <WarningCircleIcon weight="fill" className="size-4 shrink-0 text-warning" />}
        {state === "pending" && <CircleIcon className="size-4 shrink-0 text-muted-foreground/40" />}
        <span
          className={cn(
            state === "blocking" && "font-medium text-foreground",
            state === "done" && "text-foreground",
            state === "pending" && "text-muted-foreground/50",
          )}
        >
          {label}
        </span>
      </div>
      {state === "blocking" && detail && (
        <div className="ml-6 flex items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
          {detail}
        </div>
      )}
    </div>
  )
}

export function ApprovalClient() {
  const { workspaceId, featureId } = useParams<{ workspaceId: string; featureId: string }>()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [isRejecting, setIsRejecting] = useState(false)
  const [reason, setReason] = useState("")

  const detailsQuery = useQuery(
    trpc.feature.getApprovalDetails.queryOptions(
      { workspaceId, featureId },
      {
        refetchInterval: (query) => {
          const data = query.state.data
          const running = data?.readinessRun?.status === "running" || data?.readinessRun?.status === "pending"
          const waitingOnFirstCheck = data?.feature.status === "REVIEW_PASSED" && !data?.readinessRun
          return running || waitingOnFirstCheck ? 2000 : false
        },
      },
    ),
  )
  const workspaceQuery = useQuery(trpc.workspace.getById.queryOptions({ workspaceId }))
  const reviewHistoryQuery = useQuery(
    trpc.review.getByFeature.queryOptions({ workspaceId, featureId }, { enabled: !!detailsQuery.data?.pr }),
  )

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.feature.getApprovalDetails.queryKey({ workspaceId, featureId }) })
    queryClient.invalidateQueries({ queryKey: trpc.feature.getById.queryKey({ workspaceId, featureId }) })
  }

  const requestCheck = useMutation(
    trpc.feature.requestReleaseReadinessCheck.mutationOptions({
      onSuccess: () => {
        toast.success("Re-checking release readiness")
        invalidate()
      },
      onError: (error) => toast.error(error.message || "Could not start the check"),
    }),
  )

  const approve = useMutation(
    trpc.feature.approve.mutationOptions({
      onSuccess: () => {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
        toast.success("Feature shipped!")
        invalidate()
      },
      onError: (error) => toast.error(error.message || "Could not approve this feature"),
    }),
  )

  const reject = useMutation(
    trpc.feature.reject.mutationOptions({
      onSuccess: () => {
        toast.success("Feature rejected")
        setIsRejecting(false)
        setReason("")
        invalidate()
      },
      onError: (error) => toast.error(error.message || "Could not reject this feature"),
    }),
  )

  const details = detailsQuery.data
  const role = workspaceQuery.data?.role

  useSetFeatureHeaderAction(
    useMemo(() => {
      return (
        <ApprovalGate role={role} featureStatus={details?.feature.status}>
          <div className="flex items-center gap-2">
            <Button
              className="rounded-full bg-destructive px-4 py-1.5 text-sm text-white ring-offset-2 transition duration-200 hover:bg-destructive hover:ring-2 hover:ring-destructive dark:ring-offset-black"
              onClick={() => setIsRejecting(true)}
            >
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <XCircleIcon className="size-4" />
                Reject
              </span>
            </Button>
            <StatefulButton
              className="px-4 py-1.5 text-sm"
              onClick={() => approve.mutateAsync({ workspaceId, featureId })}
            >
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <RocketLaunchIcon className="size-4" />
                Approve &amp; Ship
              </span>
            </StatefulButton>
          </div>
        </ApprovalGate>
      )
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role, details?.feature.status, workspaceId, featureId]),
  )

  if (detailsQuery.isLoading) {
    return <div className="w-full py-16" />
  }

  if (!details) {
    return null
  }

  const { feature, prd, tasksTotal, tasksDone, pr, latestReview, readinessRun } = details

  // State 1 — nothing to approve yet.
  if (PRE_REVIEW_STATUS_SET.has(feature.status)) {
    return (
      <div className="flex w-full flex-col items-center gap-1 py-16 text-center">
        <span className="text-sm font-medium text-muted-foreground">Approval</span>
        <span className="text-sm text-muted-foreground/70">
          Opens once the AI review passes with no blocking issues
        </span>
      </div>
    )
  }

  const isCheckingReadiness =
    feature.status === "REVIEW_PASSED" &&
    (!readinessRun || readinessRun.status === "running" || readinessRun.status === "pending")
  const readinessNotReady = feature.status === "REVIEW_PASSED" && readinessRun?.status === "completed"

  const checklist: { key: string; label: string; done: boolean; reason?: ReactNode }[] = [
    {
      key: "prd",
      label: "PRD generated and approved",
      done: !!prd && !!feature.approvedAt,
      reason: !prd ? "The PRD hasn't been generated yet." : "The PRD hasn't been approved yet.",
    },
    {
      key: "tasks",
      label: `All tasks completed (${tasksDone}/${tasksTotal})`,
      done: tasksTotal > 0 ? tasksDone === tasksTotal : true,
      reason: `${tasksTotal - tasksDone} task(s) are not marked DONE.`,
    },
    {
      key: "pr",
      label: "PR linked",
      done: !!pr,
      reason: "No pull request has been linked yet.",
    },
    {
      key: "review",
      label: "AI review passed",
      done: latestReview?.status === "PASSED",
      reason: latestReview ? "The latest AI review has not passed yet." : "The AI review hasn't run yet.",
    },
    {
      key: "noBlocking",
      label: "No blocking issues",
      done: (latestReview?.blockingCount ?? 1) === 0,
      reason: `${latestReview?.blockingCount ?? 0} blocking issue(s) must be resolved.`,
    },
    {
      key: "readiness",
      label: "Release readiness check passed",
      done: ["PENDING_APPROVAL", "SHIPPED"].includes(feature.status),
      reason: isCheckingReadiness ? undefined : (readinessRun?.progressMessage ?? "Release readiness check hasn't passed yet."),
    },
  ]

  const blockingIndex = checklist.findIndex((item) => !item.done)

  return (
    <div className="flex w-full flex-col gap-6 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Approval checklist</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {checklist.map((item, index) => {
            const state: ChecklistState =
              index < blockingIndex || blockingIndex === -1 ? "done" : index === blockingIndex ? "blocking" : "pending"

            const detail =
              state === "blocking" && item.key === "readiness" && isCheckingReadiness ? (
                <div className="flex flex-1 items-center gap-3">
                  <AlfredAvatar pulse />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <span className="text-sm text-foreground">
                      {readinessRun?.progressMessage ?? "Alfred is checking release readiness..."}
                    </span>
                    <Progress value={readinessRun?.progressPercent ?? 20} />
                  </div>
                </div>
              ) : state === "blocking" && item.key === "readiness" && readinessNotReady ? (
                <>
                  <span className="text-sm text-muted-foreground">{item.reason}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={requestCheck.isPending}
                    onClick={() => requestCheck.mutate({ workspaceId, featureId })}
                  >
                    {requestCheck.isPending && <SpinnerIcon className="size-3.5 animate-spin" />}
                    Re-check
                  </Button>
                </>
              ) : state === "blocking" ? (
                <span className="text-sm text-muted-foreground">{item.reason}</span>
              ) : undefined

            return <ChecklistRow key={item.key} label={item.label} state={state} detail={detail} />
          })}
        </CardContent>
      </Card>

      {feature.status === "SHIPPED" && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-8 text-center">
          <span className="text-lg">🎉</span>
          <span className="text-sm font-medium text-success">Feature shipped!</span>
          <Link
            href={`/workspace/${workspaceId}/changelog`}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            View it on the changelog
          </Link>
        </div>
      )}

      {feature.status === "REJECTED" && (
        <div className="flex flex-col gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-4">
          <span className="text-sm font-medium text-destructive">Rejected</span>
          <span className="text-sm text-muted-foreground">{feature.rejectionReason}</span>
        </div>
      )}

      {prd?.problemStatement && (
        <details className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
          <summary className="cursor-pointer text-xs font-medium tracking-wide text-muted-foreground uppercase">
            PRD summary
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{prd.problemStatement}</p>
        </details>
      )}

      {pr && (
        <details className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
          <summary className="flex cursor-pointer items-center justify-between gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <span className="flex items-center gap-2 normal-case">
              <GitPullRequestIcon className="size-3.5 shrink-0" />
              Pull request
            </span>
            <StatusBadge status={pr.status} />
          </summary>
          <a
            href={pr.htmlUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block truncate text-sm text-foreground hover:underline"
          >
            #{pr.githubPrNumber} {pr.title}
          </a>
        </details>
      )}

      {(reviewHistoryQuery.data?.reviews.length ?? 0) > 0 && (
        <details className="group rounded-lg border border-border/60 bg-muted/20">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
            <CaretRightIcon className="size-3.5 shrink-0 transition-transform group-open:rotate-90" />
            AI review history ({reviewHistoryQuery.data?.reviews.length})
          </summary>
          <div className="flex flex-col gap-3 border-t border-border/60 px-4 py-3">
            {(reviewHistoryQuery.data?.reviews as Review[] | undefined)?.map((review) => {
              const blockingIssues = review.issues.filter((i) => i.severity === "BLOCKING")
              const nonBlockingIssues = review.issues.filter((i) => i.severity === "NON_BLOCKING")
              return (
                <div key={review.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">Review #{review.reviewNumber}</span>
                    <StatusBadge status={review.status} />
                  </div>
                  {review.summary && <p className="text-sm leading-relaxed text-muted-foreground">{review.summary}</p>}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <IssueGroupHeader label="Blocking" count={blockingIssues.length} tone="destructive" />
                      {blockingIssues.length === 0 ? (
                        <EmptyIssueState label="No blocking issues" />
                      ) : (
                        blockingIssues.map((issue) => <IssueCard key={issue.id} issue={issue} />)
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <IssueGroupHeader label="Non-blocking" count={nonBlockingIssues.length} tone="warning" />
                      {nonBlockingIssues.length === 0 ? (
                        <EmptyIssueState label="No non-blocking issues" />
                      ) : (
                        nonBlockingIssues.map((issue) => <IssueCard key={issue.id} issue={issue} />)
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </details>
      )}

      <Dialog open={isRejecting} onOpenChange={setIsRejecting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this feature</DialogTitle>
            <DialogDescription>Tell the developer what needs to change.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection..."
            rows={4}
          />
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5">
            <WarningCircleIcon weight="fill" className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span className="text-sm text-destructive">
              This can&apos;t be undone. Once rejected, the feature is permanently recorded as{" "}
              <span className="font-medium">Rejected</span> and there is no way to move it back to a previous stage
              from here.
            </span>
          </div>
          <DialogFooter>
            <StatefulButton
              disabled={!reason.trim() || reject.isPending}
              className={cn(
                "bg-destructive px-4 py-2 hover:ring-destructive",
                (!reason.trim() || reject.isPending) && "pointer-events-none opacity-50",
              )}
              onClick={() => reject.mutateAsync({ workspaceId, featureId, reason })}
            >
              Confirm rejection
            </StatefulButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
