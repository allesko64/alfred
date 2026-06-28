"use client"

import { useQuery } from "@tanstack/react-query"
import { GitMergeIcon, GitPullRequestIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/workspace/dashboard/status-dot"

export function GithubActivity({ workspaceId }: { workspaceId: string }) {
  const trpc = useTRPC()
  const { data: prs, isLoading } = useQuery(
    trpc.github.getRecentPRs.queryOptions({ workspaceId }),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub Activity</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : prs?.length ? (
          prs.map((pr) => {
            const Icon = pr.status === "MERGED" ? GitMergeIcon : GitPullRequestIcon
            return (
              <div key={pr.id} className="flex items-start gap-2.5">
                <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-xs text-foreground">
                    #{pr.githubPrNumber} {pr.title}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    {pr.repositoryName}
                    {pr.featureTitle ? ` · ${pr.featureTitle}` : ""}
                  </span>
                </div>
                <StatusBadge status={pr.status} className="shrink-0" />
              </div>
            )
          })
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <GitPullRequestIcon className="size-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              No pull requests yet — they&apos;ll land here once Alfred opens one.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
