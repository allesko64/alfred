"use client"

import { GitMergeIcon, GitPullRequestIcon } from "@phosphor-icons/react"

import { StatusBadge } from "@/components/workspace/dashboard/status-dot"
import { Button } from "@/components/ui/button"

interface PRRowData {
  id: string
  githubPrNumber: number | null
  title: string | null
  status: "OPEN" | "CLOSED" | "MERGED"
  featureId: string | null
  featureTitle: string | null
  repositoryName: string
  htmlUrl: string | null
}

export function PRRow({ pr, onLinkClick }: { pr: PRRowData; onLinkClick: () => void }) {
  const Icon = pr.status === "MERGED" ? GitMergeIcon : GitPullRequestIcon

  return (
    <div
      className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/50"
      onClick={() => pr.htmlUrl && window.open(pr.htmlUrl, "_blank", "noopener,noreferrer")}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-foreground">
          #{pr.githubPrNumber} {pr.title}
        </span>
        <span className="truncate text-xs text-muted-foreground">{pr.repositoryName}</span>
      </div>
      {pr.featureId ? (
        <span className="shrink-0 text-xs text-muted-foreground">{pr.featureTitle}</span>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground/60">Unlinked</span>
      )}
      <StatusBadge status={pr.status} className="shrink-0" />
      {!pr.featureId && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onLinkClick()
          }}
        >
          Link to feature
        </Button>
      )}
    </div>
  )
}
