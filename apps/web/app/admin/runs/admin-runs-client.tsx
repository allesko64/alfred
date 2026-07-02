"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { useTRPC } from "@/lib/trpc/client"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge, type badgeVariants } from "@/components/ui/badge"
import { StatusBadge } from "@/components/workspace/dashboard/status-dot"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { VariantProps } from "class-variance-authority"

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"]

const WORKFLOW_STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: "outline",
  running: "secondary",
  completed: "success",
  failed: "destructive",
}

const WORKFLOW_TYPES = [
  "clarification",
  "prd_generation",
  "task_generation",
  "pr_ingestion",
  "ai_review",
  "re_review",
  "release_readiness",
  "repo_vectorization",
  "changelog_generation",
] as const

const WORKFLOW_STATUSES = ["pending", "running", "completed", "failed"] as const

function formatDuration(ms: number | null) {
  if (ms === null) return "—"
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remSeconds = seconds % 60
  return `${minutes}m ${remSeconds}s`
}

function workflowTypeLabel(type: string) {
  return type
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ")
}

export function AdminRunsClient() {
  const trpc = useTRPC()
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [workflowType, setWorkflowType] = useState<string | undefined>(undefined)

  const { data: runs, isLoading } = useQuery({
    ...trpc.admin.listWorkflowRuns.queryOptions({
      status: status as (typeof WORKFLOW_STATUSES)[number] | undefined,
      workflowType: workflowType as (typeof WORKFLOW_TYPES)[number] | undefined,
    }),
    refetchInterval: 5000,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Select value={status ?? "all"} onValueChange={(v) => setStatus(!v || v === "all" ? undefined : v)}>
          <SelectTrigger size="sm">
            <SelectValue>{status ? status : "All statuses"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {WORKFLOW_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={workflowType ?? "all"}
          onValueChange={(v) => setWorkflowType(!v || v === "all" ? undefined : v)}
        >
          <SelectTrigger size="sm">
            <SelectValue>{workflowType ? workflowTypeLabel(workflowType) : "All workflow types"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All workflow types</SelectItem>
            {WORKFLOW_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {workflowTypeLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="surface-card flex flex-col">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-3 border-b border-border px-4 py-2 text-sm text-muted-foreground">
            <span>Feature</span>
            <span>Workflow</span>
            <span>Status</span>
            <span>Duration</span>
            <span>Credits</span>
            <span>Repo</span>
          </div>
          {runs?.length ? (
            runs.map((run) => (
              <div
                key={run.id}
                className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {run.featureTitle ?? <span className="text-muted-foreground">— repo-scoped —</span>}
                    </span>
                    {run.featureStatus && <StatusBadge status={run.featureStatus} className="shrink-0" />}
                  </div>
                  <span className="truncate text-sm text-muted-foreground">{run.workspaceName ?? "—"}</span>
                </div>

                <span className="text-sm text-foreground">{workflowTypeLabel(run.workflowType)}</span>

                <Badge variant={WORKFLOW_STATUS_VARIANT[run.status] ?? "outline"}>{run.status}</Badge>

                <span className="text-sm text-foreground">{formatDuration(run.durationMs)}</span>

                <span className="text-sm text-foreground">
                  {run.creditsConsumed !== null ? run.creditsConsumed : "—"}
                </span>

                <span className="truncate text-sm text-muted-foreground">{run.repoFullName ?? "—"}</span>
              </div>
            ))
          ) : (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">No workflow runs yet.</div>
          )}
        </div>
      )}
    </div>
  )
}
