"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { SpinnerIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

export function LinkPRDialog({
  workspaceId,
  pullRequest,
  onOpenChange,
}: {
  workspaceId: string
  pullRequest: { id: string; title: string | null; githubPrNumber: number | null } | null
  onOpenChange: (open: boolean) => void
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [featureId, setFeatureId] = useState<string | null>(null)

  const featuresQuery = useQuery({
    ...trpc.feature.list.queryOptions({ workspaceId }),
    enabled: !!pullRequest,
  })

  const linkablefeatures = (featuresQuery.data ?? []).filter((f) => f.status === "IN_DEVELOPMENT")

  const linkPullRequest = useMutation(
    trpc.github.linkPullRequest.mutationOptions({
      onSuccess: () => {
        toast.success("PR linked to feature")
        queryClient.invalidateQueries({ queryKey: trpc.github.getRecentPRs.queryKey({ workspaceId }) })
        setFeatureId(null)
        onOpenChange(false)
      },
      onError: (error) => toast.error(error.message || "Could not link this PR"),
    }),
  )

  return (
    <Dialog open={!!pullRequest} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link PR #{pullRequest?.githubPrNumber} to a feature</DialogTitle>
          <DialogDescription>{pullRequest?.title}</DialogDescription>
        </DialogHeader>

        <Select value={featureId} onValueChange={setFeatureId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a feature" />
          </SelectTrigger>
          <SelectContent>
            {linkablefeatures.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No features in development</div>
            ) : (
              linkablefeatures.map((feature) => (
                <SelectItem key={feature.id} value={feature.id}>
                  {feature.title}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button
            disabled={!featureId || !pullRequest || linkPullRequest.isPending}
            onClick={() =>
              pullRequest &&
              featureId &&
              linkPullRequest.mutate({ workspaceId, featureId, pullRequestId: pullRequest.id })
            }
          >
            {linkPullRequest.isPending && <SpinnerIcon className="size-4 animate-spin" />}
            Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
