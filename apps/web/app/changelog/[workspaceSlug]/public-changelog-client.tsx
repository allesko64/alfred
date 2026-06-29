"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ScrollIcon, TagIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

const TYPE_BADGE_VARIANT: Record<string, "default" | "destructive" | "secondary"> = {
  feature: "default",
  fix: "destructive",
  improvement: "secondary",
}

export function PublicChangelogClient() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>()
  const trpc = useTRPC()

  const { data, isLoading, isError } = useQuery(
    trpc.changelog.getPublicByWorkspaceSlug.queryOptions({ workspaceSlug }),
  )

  if (isError) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-1 p-6 text-center">
        <span className="text-sm font-medium text-foreground">Changelog not found</span>
        <span className="text-xs text-muted-foreground">This workspace doesn&apos;t have a public changelog.</span>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-[700px] flex-col gap-6 p-6 py-16">
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <ScrollIcon className="size-5" />
          {isLoading ? <Skeleton className="h-6 w-40" /> : `${data?.workspaceName} changelog`}
        </span>
        <span className="text-sm text-muted-foreground">What&apos;s shipped, as it ships.</span>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !data?.entries.length ? (
        <div className="flex flex-col items-center gap-1 py-16 text-center">
          <span className="text-sm font-medium text-muted-foreground">Nothing shipped yet</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {data.entries.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-1 rounded-lg border border-border px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-mono text-sm font-semibold text-foreground">
                  <TagIcon className="size-3.5 text-muted-foreground" />
                  {entry.version}
                </span>
                <Badge variant={TYPE_BADGE_VARIANT[entry.type] ?? "secondary"} className="capitalize">
                  {entry.type}
                </Badge>
              </div>
              <p className="text-sm text-foreground">{entry.entry}</p>
              <span className="text-xs text-muted-foreground">{entry.featureTitle}</span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(entry.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
