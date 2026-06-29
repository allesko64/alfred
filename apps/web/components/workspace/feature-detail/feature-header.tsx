"use client"

import { useQuery } from "@tanstack/react-query"

import { useTRPC } from "@/lib/trpc/client"
import { TopBar } from "@/components/workspace/topbar"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/workspace/dashboard/status-dot"
import { Timestamp } from "@/components/workspace/timestamp"
import { useFeatureHeaderAction } from "./feature-header-actions"

export function FeatureHeader({
  workspaceId,
  featureId,
}: {
  workspaceId: string
  featureId: string
}) {
  const trpc = useTRPC()
  const { data: feature, isLoading } = useQuery(
    trpc.feature.getById.queryOptions({ workspaceId, featureId }),
  )
  const headerAction = useFeatureHeaderAction()

  return (
    <div className="flex flex-col">
      <TopBar title="Feature" workspaceId={workspaceId} />

      <div className="flex flex-col gap-1 px-6 py-5">
        {isLoading || !feature ? (
          <Skeleton className="h-12 w-full max-w-md" />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-foreground">{feature.title}</h1>
                <StatusBadge status={feature.status} />
              </div>
              {headerAction}
            </div>
            <span className="text-xs text-muted-foreground">
              Created by {feature.createdByName ?? feature.createdByEmail} ·{" "}
              <Timestamp date={feature.createdAt} />
            </span>
          </>
        )}
      </div>
    </div>
  )
}
