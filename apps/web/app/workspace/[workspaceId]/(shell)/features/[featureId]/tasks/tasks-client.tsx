"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircleIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { LoaderOne } from "@/components/ui/loader"
import { Button as StatefulButton } from "@/components/ui/stateful-button"
import { useSetFeatureHeaderAction } from "@/components/workspace/feature-detail/feature-header-actions"
import { KanbanBoard } from "@/components/workspace/feature-detail/kanban/kanban-board"
import { BranchNameBanner } from "@/components/workspace/feature-detail/branch-name-banner"
import type { TaskStatus } from "@/components/workspace/feature-detail/kanban/types"

export function TasksClient() {
  const { workspaceId, featureId } = useParams<{ workspaceId: string; featureId: string }>()
  const router = useRouter()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: feature } = useQuery(trpc.feature.getById.queryOptions({ workspaceId, featureId }))
  const isGeneratingTasks = feature?.status === "TASK_GENERATION"

  const { data: repositories } = useQuery(trpc.github.listRepositories.queryOptions({ workspaceId }))
  const connectedRepo =
    repositories?.find((repo) => repo.projectId === feature?.projectId && !repo.disconnectedAt) ??
    repositories?.find((repo) => !repo.disconnectedAt)
  const repoName = connectedRepo?.name ?? connectedRepo?.fullName ?? null

  const { data: progress } = useQuery(
    trpc.feature.getWorkflowProgress.queryOptions(
      { workspaceId, featureId },
      { enabled: isGeneratingTasks, refetchInterval: isGeneratingTasks ? 2000 : false },
    ),
  )

  const tasksQuery = useQuery(
    trpc.task.getByFeature.queryOptions(
      { workspaceId, featureId },
      { enabled: !!feature && !isGeneratingTasks && feature.status !== "DRAFT" && feature.status !== "CLARIFYING" && feature.status !== "PRD_GENERATION" && feature.status !== "PRD_READY" },
    ),
  )

  const membersQuery = useQuery(trpc.workspace.listMembers.queryOptions({ workspaceId }))

  const invalidateTasks = () =>
    queryClient.invalidateQueries({ queryKey: trpc.task.getByFeature.queryKey({ workspaceId, featureId }) })

  const moveTask = useMutation(trpc.task.move.mutationOptions({ onSuccess: invalidateTasks }))
  const updateTask = useMutation(trpc.task.update.mutationOptions({ onSuccess: invalidateTasks }))
  const markDone = useMutation(trpc.task.updateStatus.mutationOptions({ onSuccess: invalidateTasks }))

  const approvePlan = useMutation(
    trpc.task.approvePlan.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.feature.getById.queryKey({ workspaceId, featureId }) })
      },
    }),
  )

  const tasks = tasksQuery.data ?? []
  const members = membersQuery.data ?? []
  const isApproved = feature?.status === "IN_DEVELOPMENT"
  const showApprovalAction = tasks.length > 0 && !isGeneratingTasks && feature?.status === "PLANNING"

  useSetFeatureHeaderAction(
    useMemo(() => {
      if (!showApprovalAction) return null

      return (
        <div className="flex flex-col items-end gap-1">
          <StatefulButton onClick={() => approvePlan.mutateAsync({ workspaceId, featureId })}>
            Approve Plan
          </StatefulButton>
          <span className="text-sm text-muted-foreground">Moves this feature into development</span>
        </div>
      )
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showApprovalAction, workspaceId, featureId]),
  )

  // Once approved, show a brief success state, then dismiss it — the user
  // stays on the kanban board rather than being navigated away. Only fires
  // for a *live* transition into IN_DEVELOPMENT (status changing while this
  // component is mounted), not when the feature was already approved before
  // the page loaded — otherwise it'd replay every time you navigate back.
  const previousStatusRef = useRef<string | undefined>(undefined)
  const [showApproved, setShowApproved] = useState(false)

  useEffect(() => {
    if (!feature) return
    const previousStatus = previousStatusRef.current
    previousStatusRef.current = feature.status

    if (previousStatus !== undefined && previousStatus !== "IN_DEVELOPMENT" && isApproved) {
      setShowApproved(true)
      const timeout = setTimeout(() => {
        router.push(`/workspace/${workspaceId}/features/${featureId}/review`)
      }, 1400)
      return () => clearTimeout(timeout)
    }
  }, [feature, isApproved, featureId, router, workspaceId])

  if (isGeneratingTasks || tasksQuery.isLoading) {
    return (
      <div className="flex max-w-[700px] flex-col items-center gap-4 py-16 text-center">
        <LoaderOne />
        <p className="text-sm text-muted-foreground">{progress?.progressMessage ?? "Alfred is breaking down tasks..."}</p>
      </div>
    )
  }

  if (!tasks.length) {
    return (
      <div className="flex max-w-[700px] flex-col gap-1 py-16 text-center">
        <span className="text-sm font-medium text-foreground">No tasks yet</span>
        <span className="text-sm text-muted-foreground">Approve the PRD to generate engineering tasks.</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 pt-1 pb-6">
      <BranchNameBanner featureId={featureId} featureTitle={feature?.title ?? ""} repoName={repoName} />
      <KanbanBoard
        tasks={tasks}
        members={members}
        isSavingTask={updateTask.isPending || markDone.isPending}
        onMove={(taskId, status, position) => moveTask.mutate({ workspaceId, taskId, status, position })}
        onUpdate={(taskId, patch) => updateTask.mutate({ workspaceId, taskId, ...patch })}
        onMarkDone={(taskId) => markDone.mutate({ workspaceId, taskId, status: "DONE" as TaskStatus })}
      />

      <AnimatePresence>
        {showApproved && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          >
            <div className="flex w-72 flex-col items-center gap-4 rounded-xl border border-border bg-card px-8 py-8 text-center shadow-2xl">
              <div className="flex size-12 items-center justify-center rounded-full bg-success text-success-foreground">
                <CheckCircleIcon className="size-6" />
              </div>
              <span className="text-sm font-medium text-foreground">
                Plan approved — moving into development
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
