"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import confetti from "canvas-confetti"
import {
  CheckCircleIcon,
  CircleIcon,
  GitPullRequestIcon,
  RocketLaunchIcon,
  SpinnerIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { StatusBadge } from "@/components/workspace/dashboard/status-dot"
import { AlfredAvatar } from "@/components/workspace/conversation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const PRE_REVIEW_STATUSES = new Set([
  "DRAFT",
  "CLARIFYING",
  "PRD_GENERATION",
  "PRD_READY",
  "TASK_GENERATION",
  "PLANNING",
  "IN_DEVELOPMENT",
  "PR_LINKED",
  "REVIEWING",
  "CHANGES_REQUESTED",
  "RE_REVIEWING",
])

const APPROVER_ROLES = new Set(["owner", "admin", "reviewer"])

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckCircleIcon weight="fill" className="size-4 shrink-0 text-success" />
      ) : (
        <CircleIcon className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
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

  if (detailsQuery.isLoading) {
    return <div className="max-w-[700px] py-16" />
  }

  const details = detailsQuery.data
  if (!details) {
    return null
  }

  const { feature, prd, tasksTotal, tasksDone, pr, latestReview, readinessRun } = details
  const role = workspaceQuery.data?.role
  const canApprove = !!role && APPROVER_ROLES.has(role)

  // State 1 — nothing to approve yet.
  if (PRE_REVIEW_STATUSES.has(feature.status)) {
    return (
      <div className="flex max-w-[700px] flex-col items-center gap-1 py-16 text-center">
        <span className="text-sm font-medium text-muted-foreground">Approval</span>
        <span className="text-sm text-muted-foreground/70">
          Opens once the AI review passes with no blocking issues
        </span>
      </div>
    )
  }

  const checklist = [
    { done: !!prd && !!feature.approvedAt, label: "PRD generated and approved" },
    {
      done: tasksTotal > 0 ? tasksDone === tasksTotal : true,
      label: `All tasks completed (${tasksDone}/${tasksTotal})`,
    },
    { done: !!pr, label: "PR linked" },
    { done: latestReview?.status === "PASSED", label: "AI review passed" },
    { done: (latestReview?.blockingCount ?? 1) === 0, label: "No blocking issues" },
    {
      done: ["PENDING_APPROVAL", "APPROVED", "SHIPPED"].includes(feature.status),
      label: "Release readiness check passed",
    },
  ]

  const isCheckingReadiness =
    feature.status === "REVIEW_PASSED" &&
    (!readinessRun || readinessRun.status === "running" || readinessRun.status === "pending")
  const readinessNotReady = feature.status === "REVIEW_PASSED" && readinessRun?.status === "completed"

  return (
    <div className="flex max-w-[700px] flex-col gap-6 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Approval checklist</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {checklist.map((item) => (
            <ChecklistItem key={item.label} done={item.done} label={item.label} />
          ))}
        </CardContent>
      </Card>

      {isCheckingReadiness && (
        <div className="flex w-full items-center gap-4 rounded-lg bg-muted px-4 py-4">
          <AlfredAvatar pulse />
          <div className="flex flex-1 flex-col gap-2">
            <span className="text-sm text-foreground">
              {readinessRun?.progressMessage ?? "Alfred is checking release readiness..."}
            </span>
            <Progress value={readinessRun?.progressPercent ?? 20} />
          </div>
        </div>
      )}

      {readinessNotReady && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-4">
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-warning">Not ready for approval yet</span>
            <span className="text-sm text-muted-foreground">{readinessRun?.progressMessage}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={requestCheck.isPending}
            onClick={() => requestCheck.mutate({ workspaceId, featureId })}
          >
            {requestCheck.isPending && <SpinnerIcon className="size-3.5 animate-spin" />}
            Re-check
          </Button>
        </div>
      )}

      {prd?.problemStatement && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">PRD summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-muted-foreground">{prd.problemStatement}</p>
          </CardContent>
        </Card>
      )}

      {pr && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <GitPullRequestIcon className="size-4 shrink-0 text-muted-foreground" />
              <a href={pr.htmlUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                #{pr.githubPrNumber} {pr.title}
              </a>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={pr.status} />
          </CardContent>
        </Card>
      )}

      {(reviewHistoryQuery.data?.reviews.length ?? 0) > 0 && (
        <details className="rounded-lg border border-border px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            AI review history ({reviewHistoryQuery.data?.reviews.length})
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {reviewHistoryQuery.data?.reviews.map((review) => (
              <div key={review.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">Review #{review.reviewNumber}</span>
                <StatusBadge status={review.status} />
                <span className="text-muted-foreground">
                  {review.blockingCount} blocking · {review.nonBlockingCount} non-blocking
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {feature.status === "PENDING_APPROVAL" && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="destructive" disabled={!canApprove} onClick={() => setIsRejecting(true)}>
            <XCircleIcon />
            Reject
          </Button>
          <Button disabled={!canApprove || approve.isPending} onClick={() => approve.mutate({ workspaceId, featureId })}>
            {approve.isPending && <SpinnerIcon className="size-4 animate-spin" />}
            <RocketLaunchIcon />
            Approve &amp; Ship
          </Button>
        </div>
      )}

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
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={!reason.trim() || reject.isPending}
              onClick={() => reject.mutate({ workspaceId, featureId, reason })}
            >
              {reject.isPending && <SpinnerIcon className="size-4 animate-spin" />}
              Confirm rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
