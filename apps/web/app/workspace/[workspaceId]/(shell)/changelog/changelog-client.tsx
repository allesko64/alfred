"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ScrollIcon, TagIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { TopBar } from "@/components/workspace/topbar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Timestamp } from "@/components/workspace/timestamp"

const TYPE_BADGE_VARIANT: Record<string, "default" | "destructive" | "secondary"> = {
  feature: "default",
  fix: "destructive",
  improvement: "secondary",
}

export function ChangelogClient() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const trpc = useTRPC()

  const { data: entries, isLoading } = useQuery(trpc.changelog.getByWorkspace.queryOptions({ workspaceId }))
  const { data: workspace } = useQuery(trpc.workspace.getById.queryOptions({ workspaceId }))

  type ChangelogEntry = NonNullable<typeof entries>[number]
  const grouped: Record<string, ChangelogEntry[]> = {}
  for (const entry of entries ?? []) {
    ;(grouped[entry.version] ??= []).push(entry)
  }
  const versions = Object.keys(grouped)

  return (
    <div className="flex flex-col">
      <TopBar title="Changelog" workspaceId={workspaceId} />

      <div className="flex flex-col gap-6 p-6">
        {workspace && (
          <Link
            href={`/changelog/${workspace.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            <ScrollIcon className="size-3.5" />
            View public changelog
          </Link>
        )}

        {isLoading ? (
          <Skeleton className="h-48 w-full max-w-[700px]" />
        ) : !entries || entries.length === 0 ? (
          <div className="flex max-w-[700px] flex-col items-center gap-1 py-16 text-center">
            <ScrollIcon className="size-5 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">No entries yet</span>
            <span className="text-sm text-muted-foreground/70">
              A changelog entry is written automatically every time a feature ships
            </span>
          </div>
        ) : (
          <div className="flex max-w-[700px] flex-col gap-6">
            {versions.map((version) => (
              <div key={version} className="flex gap-4">
                <div className="flex flex-col items-center pt-1">
                  <TagIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="mt-1 w-px flex-1 bg-border" />
                </div>
                <div className="flex flex-1 flex-col gap-3 pb-2">
                  <span className="font-mono text-sm font-semibold text-foreground">{version}</span>
                  {grouped[version]!.map((entry) => (
                    <div key={entry.id} className="flex flex-col gap-1 rounded-lg border border-border px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={TYPE_BADGE_VARIANT[entry.type] ?? "secondary"} className="capitalize">
                          {entry.type}
                        </Badge>
                        <Timestamp date={entry.createdAt} className="text-[10px] text-muted-foreground" />
                      </div>
                      <p className="text-lg text-foreground">{entry.entry}</p>
                      <Link
                        href={`/workspace/${workspaceId}/features/${entry.featureId}`}
                        className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {entry.featureTitle}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
