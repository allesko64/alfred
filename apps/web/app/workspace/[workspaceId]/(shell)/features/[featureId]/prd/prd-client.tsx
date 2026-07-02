"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircleIcon, PlusIcon, TrashIcon, WarningCircleIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoaderOne } from "@/components/ui/loader"
import { Button as StatefulButton } from "@/components/ui/stateful-button"
import { Textarea } from "@/components/ui/textarea"
import { useSetFeatureHeaderAction } from "@/components/workspace/feature-detail/feature-header-actions"
import { ShareDialog } from "@/components/workspace/feature-detail/share-dialog"
import { DecisionPills } from "@/components/workspace/conversation"
import { downloadTextFile, prdToMarkdown } from "@/lib/export-markdown"
import { slugify } from "@/lib/utils"

type PRDFormState = {
  problemStatement: string
  goals: string[]
  nonGoals: string[]
  userStories: string[]
  acceptanceCriteria: string[]
  assumptions: string[]
}

function EditableList({
  items,
  onChange,
  placeholder,
}: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <Textarea
            value={item}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((v, idx) => (idx === i ? e.target.value : v)))}
            className="min-h-9 rounded-md"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
          >
            <TrashIcon />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
        <PlusIcon data-icon="inline-start" /> Add
      </Button>
    </div>
  )
}

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

  // Poll while PRD/task generation is in flight — otherwise this query only
  // fetches once and never notices the background job finishing, leaving the
  // writing-loader stuck on screen forever instead of swapping in the PRD.
  const { data: feature } = useQuery(
    trpc.feature.getById.queryOptions(
      { workspaceId, featureId },
      { refetchInterval: (query) => {
        const status = query.state.data?.status
        return status === "PRD_GENERATION" || status === "TASK_GENERATION" ? 2000 : false
      } },
    ),
  )
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

  const updatePRD = useMutation(
    trpc.prd.update.mutationOptions({
      onSuccess: (updated) => {
        queryClient.setQueryData(trpc.prd.getByFeature.queryKey({ workspaceId, featureId }), updated)
        setIsEditing(false)
        setForm(null)
      },
    }),
  )

  const prd = prdQuery.data
  const showApprovalAction = !!prd && feature?.status !== "REJECTED" && !feature?.approvedAt
  const isPrdApproved = !!prd && !!feature?.approvedAt

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<PRDFormState | null>(null)

  function startEditing() {
    if (!prd) return
    setForm({
      problemStatement: prd.problemStatement ?? "",
      goals: (prd.goals as string[] | null) ?? [],
      nonGoals: (prd.nonGoals as string[] | null) ?? [],
      userStories: (prd.userStories as string[] | null) ?? [],
      acceptanceCriteria: (prd.acceptanceCriteria as string[] | null) ?? [],
      assumptions: (prd.assumptions as string[] | null) ?? [],
    })
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setForm(null)
  }

  function saveEditing() {
    if (!form) return
    updatePRD.mutate({
      workspaceId,
      featureId,
      problemStatement: form.problemStatement,
      goals: form.goals.filter((v) => v.trim().length > 0),
      nonGoals: form.nonGoals.filter((v) => v.trim().length > 0),
      userStories: form.userStories.filter((v) => v.trim().length > 0),
      acceptanceCriteria: form.acceptanceCriteria.filter((v) => v.trim().length > 0),
      assumptions: form.assumptions.filter((v) => v.trim().length > 0),
    })
  }

  useSetFeatureHeaderAction(
    useMemo(() => {
      if (isEditing) {
        return (
          <div className="flex items-center gap-2">
            <StatefulButton
              className="bg-secondary text-secondary-foreground hover:ring-secondary"
              onClick={cancelEditing}
              disabled={updatePRD.isPending}
            >
              Cancel
            </StatefulButton>
            <StatefulButton onClick={saveEditing}>Save PRD</StatefulButton>
          </div>
        )
      }

      if (isPrdApproved) {
        return (
          <ShareDialog
            workspaceId={workspaceId}
            featureId={featureId}
            downloadLabel="Download Markdown"
            onDownload={() => {
              if (!prd || !feature) return
              downloadTextFile(`${slugify(feature.title)}-prd.md`, prdToMarkdown(feature.title, prd))
            }}
          />
        )
      }

      if (!prd || !showApprovalAction) return null

      return (
        <div className="flex items-center gap-2">
          <StatefulButton
            className="bg-neutral-500 hover:ring-neutral-500 dark:bg-neutral-600 dark:hover:ring-neutral-600"
            onClick={startEditing}
          >
            Edit PRD
          </StatefulButton>
          <StatefulButton onClick={() => approvePRD.mutateAsync({ workspaceId, featureId })}>
            Approve PRD
          </StatefulButton>
        </div>
      )
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing, showApprovalAction, isPrdApproved, workspaceId, featureId, prd, feature, updatePRD.isPending, form]),
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

  if (feature?.status === "DRAFT" || feature?.status === "CLARIFYING") {
    return (
      <div className="flex max-w-[700px] flex-col items-center gap-2 py-16 text-center">
        <span className="text-sm font-medium text-foreground">Finish the conversation first</span>
        <span className="max-w-sm text-sm text-muted-foreground">
          Alfred is still gathering details about this feature. Answer the remaining questions in the
          conversation and the PRD will start generating automatically.
        </span>
      </div>
    )
  }

  if (isWritingPRD || !prd) {
    return (
      <div className="flex max-w-[700px] flex-col items-center gap-4 py-16 text-center">
        <LoaderOne />
        <p className="text-sm text-muted-foreground">{progress?.progressMessage ?? "Alfred is writing your PRD..."}</p>
      </div>
    )
  }

  if (isEditing && form) {
    return (
      <div className="flex w-full flex-col gap-6 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <PRDCard title="Problem Statement" index={0} className="md:col-span-2">
            <Textarea
              value={form.problemStatement}
              onChange={(e) => setForm({ ...form, problemStatement: e.target.value })}
              className="min-h-24 rounded-md"
            />
          </PRDCard>

          <PRDCard title="Goals" index={1}>
            <EditableList
              items={form.goals}
              onChange={(goals) => setForm({ ...form, goals })}
              placeholder="Add a goal"
            />
          </PRDCard>

          <PRDCard title="Non Goals" index={2}>
            <EditableList
              items={form.nonGoals}
              onChange={(nonGoals) => setForm({ ...form, nonGoals })}
              placeholder="Add a non-goal"
            />
          </PRDCard>

          <PRDCard title="User Stories" index={3} className="md:col-span-2">
            <EditableList
              items={form.userStories}
              onChange={(userStories) => setForm({ ...form, userStories })}
              placeholder="Add a user story"
            />
          </PRDCard>

          <PRDCard title="Acceptance Criteria" index={4}>
            <EditableList
              items={form.acceptanceCriteria}
              onChange={(acceptanceCriteria) => setForm({ ...form, acceptanceCriteria })}
              placeholder="Add acceptance criteria"
            />
          </PRDCard>

          <PRDCard title="Assumptions" index={5}>
            <EditableList
              items={form.assumptions}
              onChange={(assumptions) => setForm({ ...form, assumptions })}
              placeholder="Add an assumption"
            />
          </PRDCard>
        </div>
      </div>
    )
  }

  const goals = (prd.goals as string[] | null) ?? []
  const nonGoals = (prd.nonGoals as string[] | null) ?? []
  const userStories = (prd.userStories as string[] | null) ?? []
  const acceptanceCriteria = (prd.acceptanceCriteria as string[] | null) ?? []
  const assumptions = (prd.assumptions as string[] | null) ?? []

  const decisionPills = feature?.decisionPills ?? []

  return (
    <div className="flex w-full flex-col gap-6 py-6">
      {decisionPills.length > 0 && <DecisionPills pills={decisionPills} variant="inline" />}

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
                  <LoaderOne />
                  <span className="text-sm font-medium text-foreground">
                    {taskProgress?.progressMessage ?? "Alfred is breaking down tasks..."}
                  </span>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
