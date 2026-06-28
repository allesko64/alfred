"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { useTRPC } from "@/lib/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function FeaturePipeline({ workspaceId }: { workspaceId: string }) {
  const trpc = useTRPC()
  const { data: stages, isLoading } = useQuery(
    trpc.feature.getPipelineCounts.queryOptions({ workspaceId }),
  )

  const total = stages?.reduce((sum, stage) => sum + stage.count, 0) ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Pipeline</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          stages?.map((stage) => {
            const percent = total > 0 ? (stage.count / total) * 100 : 0
            return (
              <Link
                key={stage.key}
                href={`/workspace/${workspaceId}/features?status=${stage.statuses.join(",")}`}
                className="flex items-center gap-3 hover:opacity-80"
              >
                <span className="w-28 shrink-0 text-xs text-foreground">{stage.label}</span>
                <div className="h-1.5 flex-1 bg-muted">
                  <div
                    className="h-full bg-foreground/60"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-xs text-muted-foreground">
                  {stage.count}
                </span>
              </Link>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
