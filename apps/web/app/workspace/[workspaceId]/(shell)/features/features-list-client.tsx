"use client"

import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { SparkleIcon, XIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { TopBar } from "@/components/workspace/topbar"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge, statusLabel } from "@/components/workspace/dashboard/status-dot"
import { Timestamp } from "@/components/workspace/timestamp"

export function FeaturesListClient() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const searchParams = useSearchParams()
  const trpc = useTRPC()
  const { data: allFeatures, isLoading } = useQuery(trpc.feature.list.queryOptions({ workspaceId }))

  const statusFilter = searchParams.get("status")?.split(",").filter(Boolean) ?? []
  const features = statusFilter.length
    ? allFeatures?.filter((feature) => statusFilter.includes(feature.status))
    : allFeatures

  return (
    <div className="flex flex-col">
      <TopBar title="Features" workspaceId={workspaceId} />

      <div className="flex flex-col gap-3 p-6">
        {statusFilter.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Filtered by {statusFilter.map(statusLabel).join(", ")}
            <Link
              href={`/workspace/${workspaceId}/features`}
              className="flex items-center gap-1 text-foreground hover:underline"
            >
              <XIcon className="size-3" />
              Clear
            </Link>
          </div>
        )}

        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : features?.length ? (
          <div className="surface-card flex flex-col">
            {features.map((feature) => (
              <Link
                key={feature.id}
                href={`/workspace/${workspaceId}/features/${feature.id}`}
                className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {feature.title}
                  </span>
                  <Timestamp date={feature.updatedAt} className="truncate text-xs text-muted-foreground" />
                </div>
                <StatusBadge status={feature.status} className="shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <Link
            href={`/workspace/${workspaceId}/features/new`}
            className="flex flex-col items-center gap-2 py-10 text-center hover:text-foreground"
          >
            <SparkleIcon className="size-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Describe your first feature and Alfred will take it from here.
            </span>
          </Link>
        )}
      </div>
    </div>
  )
}
