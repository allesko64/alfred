"use client"

import { useQuery } from "@tanstack/react-query"

import { useTRPC } from "@/lib/trpc/client"
import { FeatureFloatingDock } from "@/components/workspace/feature-detail/floating-dock"

const PULSE_SEGMENT_BY_STATUS: Record<string, string> = {
  PRD_GENERATION: "prd",
  TASK_GENERATION: "tasks",
}

const PRE_DEVELOPMENT_STATUSES = new Set([
  "DRAFT",
  "CLARIFYING",
  "PRD_GENERATION",
  "PRD_READY",
  "TASK_GENERATION",
  "PLANNING",
])

export function FeatureDock({
  workspaceId,
  featureId,
}: {
  workspaceId: string
  featureId: string
}) {
  const trpc = useTRPC()
  const { data: feature } = useQuery(trpc.feature.getById.queryOptions({ workspaceId, featureId }))

  return (
    <FeatureFloatingDock
      workspaceId={workspaceId}
      featureId={featureId}
      pulseSegment={feature ? PULSE_SEGMENT_BY_STATUS[feature.status] : undefined}
      mutedSegment={feature && PRE_DEVELOPMENT_STATUSES.has(feature.status) ? "review" : undefined}
    />
  )
}
