"use client"

import { useParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { SpinnerIcon, WarningCircleIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { AlfredLogo } from "@/components/icons/alfred-logo"

const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
}

function Section({
  title,
  index,
  children,
}: {
  title: string
  index: number
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={SECTION_VARIANTS}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex flex-col gap-2"
    >
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
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
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: feature } = useQuery(trpc.feature.getById.queryOptions({ workspaceId, featureId }))
  const isWritingPRD = feature?.status === "PRD_GENERATION"

  const { data: progress } = useQuery(
    trpc.feature.getWorkflowProgress.queryOptions(
      { workspaceId, featureId },
      { enabled: isWritingPRD, refetchInterval: isWritingPRD ? 2000 : false },
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
  const isApproved = !!feature?.approvedAt
  const isApproving = approvePRD.isPending || isApproved

  if (feature?.status === "REJECTED") {
    return (
      <div className="flex max-w-[700px] items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-4">
        <WarningCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-destructive">PRD generation was blocked</span>
          <span className="text-xs text-muted-foreground">{feature.rejectionReason}</span>
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
          <span className="text-sm text-foreground">
            {progress?.progressMessage ?? "Alfred is writing your PRD..."}
          </span>
          <Progress value={progress?.progressPercent ?? 10} />
        </div>
      </div>
    )
  }

  const goals = (prd.goals as string[] | null) ?? []
  const nonGoals = (prd.nonGoals as string[] | null) ?? []
  const userStories = (prd.userStories as string[] | null) ?? []
  const acceptanceCriteria = (prd.acceptanceCriteria as string[] | null) ?? []
  const edgeCases = (prd.edgeCases as string[] | null) ?? []
  const successMetrics = (prd.successMetrics as string[] | null) ?? []
  const assumptions = (prd.assumptions as string[] | null) ?? []

  return (
    <div className="flex max-w-[700px] flex-col gap-6 py-6">
      {prd.scopeWarning && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-4">
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-warning">This feature may be too large</span>
            <span className="text-xs text-muted-foreground">{prd.scopeWarning}</span>
          </div>
        </div>
      )}

      <Section title="Problem Statement" index={0}>
        <p className="text-sm text-foreground">{prd.problemStatement}</p>
      </Section>
      <Separator />

      <Section title="Goals" index={1}>
        <BulletList items={goals} />
      </Section>
      <Separator />

      <Section title="Non Goals" index={2}>
        <BulletList items={nonGoals} />
      </Section>
      <Separator />

      <Section title="User Stories" index={3}>
        <div className="flex flex-col gap-2">
          {userStories.map((story, i) => (
            <div key={i} className="rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
              {story}
            </div>
          ))}
        </div>
      </Section>
      <Separator />

      <Section title="Acceptance Criteria" index={4}>
        <NumberedList items={acceptanceCriteria} />
      </Section>
      <Separator />

      <Section title="Edge Cases" index={5}>
        <BulletList items={edgeCases} />
      </Section>
      <Separator />

      <Section title="Success Metrics" index={6}>
        <BulletList items={successMetrics} />
      </Section>

      {assumptions.length > 0 && (
        <>
          <Separator />
          <Section title="Assumptions" index={7}>
            <BulletList items={assumptions} />
          </Section>
        </>
      )}

      <div className="flex flex-col items-center gap-2 pt-4">
        <Button
          className="w-full"
          disabled={isApproving}
          onClick={() => approvePRD.mutate({ workspaceId, featureId })}
        >
          {isApproving && <SpinnerIcon className="size-4 animate-spin" />}
          {isApproving ? "Generating tasks..." : "Approve PRD"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Approving will generate engineering tasks
        </span>
      </div>
    </div>
  )
}
