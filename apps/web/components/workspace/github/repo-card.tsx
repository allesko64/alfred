"use client"

import { CircleIcon, GitBranchIcon, SpinnerIcon } from "@phosphor-icons/react"

import { formatRelativeTime } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface RepoCardData {
  id: string
  fullName: string
  owner: string | null
  name: string | null
  defaultBranch: string | null
  isIndexed: boolean
  lastWebhookAt: Date | null
  disconnectedAt: Date | null
}

export function RepoCard({
  repo,
  onDisconnect,
  onReconnect,
  onDelete,
  isDisconnecting,
  isReconnecting,
  isDeleting,
}: {
  repo: RepoCardData
  onDisconnect: () => void
  onReconnect: () => void
  onDelete: () => void
  isDisconnecting: boolean
  isReconnecting: boolean
  isDeleting: boolean
}) {
  const isActive = !repo.disconnectedAt

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="truncate">{repo.fullName}</span>
          <Badge variant={isActive ? "success" : "outline"} className="shrink-0">
            <CircleIcon weight="fill" className="size-2" />
            {isActive ? "Active" : "Inactive"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          {repo.defaultBranch && (
            <span className="flex items-center gap-1.5">
              <GitBranchIcon className="size-3.5" />
              {repo.defaultBranch}
            </span>
          )}
          <span>
            {repo.lastWebhookAt
              ? `Last webhook ${formatRelativeTime(repo.lastWebhookAt)}`
              : "No webhooks received yet"}
          </span>
          <span>{repo.isIndexed ? "Indexed" : "Indexing not started"}</span>
        </div>

        <div className="flex justify-end gap-2">
          {isActive ? (
            <Dialog>
              <DialogTrigger render={<Button variant="ghost" size="sm" />}>Disconnect</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Disconnect {repo.fullName}?</DialogTitle>
                  <DialogDescription>
                    This removes all pull requests and indexed code for this repository. You can reconnect it
                    later.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="destructive" onClick={onDisconnect} disabled={isDisconnecting}>
                    {isDisconnecting && <SpinnerIcon className="size-4 animate-spin" />}
                    Disconnect
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button variant="outline" size="sm" onClick={onReconnect} disabled={isReconnecting}>
              {isReconnecting && <SpinnerIcon className="size-4 animate-spin" />}
              Reconnect
            </Button>
          )}
          <Dialog>
            <DialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" />}>
              Delete
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete {repo.fullName}?</DialogTitle>
                <DialogDescription>
                  This permanently removes the repository along with all its pull requests, AI reviews, and
                  indexed code. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="destructive" onClick={onDelete} disabled={isDeleting}>
                  {isDeleting && <SpinnerIcon className="size-4 animate-spin" />}
                  Delete permanently
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}
