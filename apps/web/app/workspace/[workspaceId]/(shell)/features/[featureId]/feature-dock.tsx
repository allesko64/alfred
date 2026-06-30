"use client"

import { useQuery } from "@tanstack/react-query"
import {
  PRE_APPROVAL_STATUSES,
  PRE_DEVELOPMENT_STATUSES,
} from "@alfred/db/feature-status-groups"

import { useTRPC } from "@/lib/trpc/client"
import { FeatureFloatingDock } from "@/components/workspace/feature-detail/floating-dock"

const PULSE_SEGMENT_BY_STATUS: Record<string, string> = {
  PRD_GENERATION: "prd",
  TASK_GENERATION: "tasks",
  PENDING_APPROVAL: "approval",
}

const PRE_DEVELOPMENT_STATUS_SET = new Set<string>(PRE_DEVELOPMENT_STATUSES)
const PRE_APPROVAL_STATUS_SET = new Set<string>(PRE_APPROVAL_STATUSES)

export function FeatureDock({
  workspaceId,
  featureId,
}: {
  workspaceId: string
  featureId: string
}) {
  const trpc = useTRPC()
  const { data: feature } = useQuery(trpc.feature.getById.queryOptions({ workspaceId, featureId }))

  const mutedSegments: string[] = []
  if (feature && PRE_DEVELOPMENT_STATUS_SET.has(feature.status)) mutedSegments.push("review")
  if (feature && PRE_APPROVAL_STATUS_SET.has(feature.status)) mutedSegments.push("approval")

  return (
    <FeatureFloatingDock
      workspaceId={workspaceId}
      featureId={featureId}
      pulseSegment={feature ? PULSE_SEGMENT_BY_STATUS[feature.status] : undefined}
      mutedSegments={mutedSegments}
    />
  )
}
