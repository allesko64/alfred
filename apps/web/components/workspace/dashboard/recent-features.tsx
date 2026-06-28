"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { useTRPC } from "@/lib/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatRelativeTime } from "@/lib/utils"
import { StatusBadge } from "@/components/workspace/dashboard/status-dot"

export function RecentFeatures({ workspaceId }: { workspaceId: string }) {
  const trpc = useTRPC()
  const { data: recent, isLoading } = useQuery(
    trpc.feature.getRecent.queryOptions({ workspaceId }),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Features</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-0 px-0">
        {isLoading ? (
          <Skeleton className="mx-4 h-32" />
        ) : recent?.length ? (
          recent.map((feature) => (
            <Link
              key={feature.id}
              href={`/workspace/${workspaceId}/features/${feature.id}`}
              className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 first:border-t-0 hover:bg-muted"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium text-foreground">
                  {feature.title}
                </span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {feature.createdByName ?? feature.createdByEmail} ·{" "}
                  {formatRelativeTime(feature.updatedAt)}
                </span>
              </div>
              <StatusBadge status={feature.status} className="shrink-0" />
            </Link>
          ))
        ) : (
          <span className="px-4 text-xs text-muted-foreground">No features yet.</span>
        )}
      </CardContent>
    </Card>
  )
}
