"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlfredLogo } from "@/components/icons/alfred-logo"
import { LoaderFive } from "@/components/ui/loader"
import { Button as StatefulButton } from "@/components/ui/stateful-button"
import { useSetFeatureHeaderAction } from "@/components/workspace/feature-detail/feature-header-actions"

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
}

function PRDCard({
  title,
  index,
  className,
  children,
}: {
  title: string
  index: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={CARD_VARIANTS}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={className}
    >
      <Card className="h-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </motion.div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5 text-sm text-foreground">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-muted-foreground">·</span>
          {item}
        </li>
      ))}
    </ul>
  )
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="flex flex-col gap-1.5 text-sm text-foreground">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-muted-foreground">{i + 1}.</span>
          {item}
        </li>
      ))}
    </ol>
  )
}

export function PRDClient() {
  const { workspaceId, featureId } = useParams<{ workspaceId: string; featureId: string }>()
  const router = useRouter()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: feature } = useQuery(trpc.feature.getById.queryOptions({ workspaceId, featureId }))
  const isWritingPRD = feature?.status === "PRD_GENERATION"
  const isGeneratingTasks = feature?.status === "TASK_GENERATION"

  const { data: progress } = useQuery(
    trpc.feature.getWorkflowProgress.queryOptions(
      { workspaceId, featureId },
      { enabled: isWritingPRD, refetchInterval: isWritingPRD ? 2000 : false },
    ),
  )

  const { data: taskProgress } = useQuery(
    trpc.feature.getWorkflowProgress.queryOptions(
      { workspaceId, featureId },
      { enabled: isGeneratingTasks, refetchInterval: isGeneratingTasks ? 2000 : false },
    ),
  )

  const prdQuery = useQuery(
    trpc.prd.getByFeature.queryOptions(
      { workspaceId, featureId },
      { enabled: !!feature && feature.status !== "DRAFT" && feature.status !== "CLARIFYING" && !isWritingPRD },
    ),
  )

  const approvePRD = useMutation(
    trpc.prd.approve.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.feature.getById.queryKey({ workspaceId, featureId }) })
      },
    }),
  )

  const prd = prdQuery.data
  const showApprovalAction = !!prd && feature?.status !== "REJECTED" && !feature?.approvedAt

  useSetFeatureHeaderAction(
    useMemo(() => {
      if (!showApprovalAction) return null

      return (
        <div className="flex flex-col items-end gap-1">
          <StatefulButton onClick={() => approvePRD.mutateAsync({ workspaceId, featureId })}>
            Approve PRD
          </StatefulButton>
          <span className="text-sm text-muted-foreground">Generates engineering tasks</span>
        </div>
      )
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showApprovalAction, workspaceId, featureId]),
  )

  // Once task generation finishes, show a brief success state then hand off
  // to the kanban page — no manual "view tasks" button needed.
  const wasGeneratingRef = useRef(false)
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    if (isGeneratingTasks) {
      wasGeneratingRef.current = true
      return
    }
    if (wasGeneratingRef.current && feature?.approvedAt) {
      wasGeneratingRef.current = false
      setRedirecting(true)
      const timeout = setTimeout(() => {
        router.push(`/workspace/${workspaceId}/features/${featureId}/tasks`)
      }, 1400)
      return () => clearTimeout(timeout)
    }
  }, [isGeneratingTasks, feature?.approvedAt, router, workspaceId, featureId])

  if (feature?.status === "REJECTED") {
    return (
      <div className="flex max-w-[700px] items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-4">
        <WarningCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-destructive">PRD generation was blocked</span>
          <span className="text-sm text-muted-foreground">{feature.rejectionReason}</span>
        </div>
      </div>
    )
  }

  if (isWritingPRD || !prd) {
    return (
      <div className="flex max-w-[700px] flex-col items-center gap-4 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground animate-pulse">
          <AlfredLogo className="size-6" />
        </div>
        <div className="flex w-full flex-col gap-2">
          <LoaderFive text={progress?.progressMessage ?? "Alfred is writing your PRD..."} />
          <Progress value={progress?.progressPercent ?? 10} />
        </div>
      </div>
    )
  }

  const goals = (prd.goals as string[] | null) ?? []
  const nonGoals = (prd.nonGoals as string[] | null) ?? []
  const userStories = (prd.userStories as string[] | null) ?? []
  const acceptanceCriteria = (prd.acceptanceCriteria as string[] | null) ?? []
  const assumptions = (prd.assumptions as string[] | null) ?? []

  return (
    <div className="flex w-full flex-col gap-6 py-6">
      {prd.scopeWarning && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-4">
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-warning">This feature may be too large</span>
            <span className="text-sm text-muted-foreground">{prd.scopeWarning}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PRDCard title="Problem Statement" index={0} className="md:col-span-2">
          <p className="text-sm text-foreground">{prd.problemStatement}</p>
        </PRDCard>

        <PRDCard title="Goals" index={1}>
          <BulletList items={goals} />
        </PRDCard>

        <PRDCard title="Non Goals" index={2}>
          <BulletList items={nonGoals} />
        </PRDCard>

        <PRDCard title="User Stories" index={3} className="md:col-span-2">
          <div className="flex flex-col gap-2">
            {userStories.map((story, i) => (
              <div key={i} className="rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
                {story}
              </div>
            ))}
          </div>
        </PRDCard>

        <PRDCard
          title="Acceptance Criteria"
          index={4}
          className={assumptions.length === 0 ? "md:col-span-2" : undefined}
        >
          <NumberedList items={acceptanceCriteria} />
        </PRDCard>

        {assumptions.length > 0 && (
          <PRDCard title="Assumptions" index={5}>
            <BulletList items={assumptions} />
          </PRDCard>
        )}
      </div>

      <AnimatePresence>
        {(isGeneratingTasks || redirecting) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          >
            <div className="flex w-72 flex-col items-center gap-4 rounded-xl border border-border bg-card px-8 py-8 text-center shadow-2xl">
              {redirecting ? (
                <>
                  <div className="flex size-12 items-center justify-center rounded-full bg-success text-success-foreground">
                    <CheckCircleIcon className="size-6" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    Tasks are ready — taking you there now...
                  </span>
                </>
              ) : (
                <>
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground animate-pulse">
                    <AlfredLogo className="size-6" />
                  </div>
                  <div className="flex w-full flex-col gap-2">
                    <LoaderFive text={taskProgress?.progressMessage ?? "Alfred is breaking down tasks..."} />
                    <Progress value={taskProgress?.progressPercent ?? 20} />
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
