"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { CheckIcon, CopyIcon, DownloadSimpleIcon, LinkIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Button as StatefulButton } from "@/components/ui/stateful-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function ShareDialog({
  workspaceId,
  featureId,
  downloadLabel,
  onDownload,
}: {
  workspaceId: string
  featureId: string
  downloadLabel: string
  onDownload: () => void
}) {
  const trpc = useTRPC()
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const getOrCreate = useMutation(
    trpc.share.getOrCreate.mutationOptions({
      onSuccess: (result) => setToken(result.token),
      onError: () => toast.error("Couldn't generate a share link. Try again."),
    }),
  )

  const revoke = useMutation(
    trpc.share.revoke.mutationOptions({
      onSuccess: () => {
        setToken(null)
        toast.success("Share link revoked")
      },
      onError: () => toast.error("Couldn't revoke the share link. Try again."),
    }),
  )

  const shareUrl = token && typeof window !== "undefined" ? `${window.location.origin}/share/${token}` : null

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && !token) {
      getOrCreate.mutate({ workspaceId, featureId })
    }
  }

  function handleCopy() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<StatefulButton variant="green" />}>Share</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
          <DialogDescription>Download a copy or share a public, read-only link.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Button variant="outline" className="justify-start" onClick={onDownload}>
            <DownloadSimpleIcon data-icon="inline-start" />
            {downloadLabel}
          </Button>

          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <LinkIcon className="size-4" />
              Public link
            </div>

            {getOrCreate.isPending ? (
              <span className="text-sm text-muted-foreground">Generating link...</span>
            ) : shareUrl ? (
              <>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    className="h-8 flex-1 rounded-md border border-border bg-muted px-2 text-sm text-foreground"
                    onFocus={(e) => e.target.select()}
                  />
                  <Button variant="outline" size="icon-sm" onClick={handleCopy}>
                    {copied ? <CheckIcon /> : <CopyIcon />}
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">
                  Anyone with this link can view without signing in.
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start text-destructive hover:text-destructive"
                  onClick={() => revoke.mutate({ workspaceId, featureId })}
                  disabled={revoke.isPending}
                >
                  Revoke link
                </Button>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Could not load the share link.</span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
