"use client"

import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { SparkleIcon, SpinnerIcon, TrashIcon, XIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { TopBar } from "@/components/workspace/topbar"
import { Skeleton } from "@/components/ui/skeleton"
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
import { StatusBadge, statusLabel } from "@/components/workspace/dashboard/status-dot"
import { Timestamp } from "@/components/workspace/timestamp"

export function FeaturesListClient() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const searchParams = useSearchParams()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: allFeatures, isLoading } = useQuery(trpc.feature.list.queryOptions({ workspaceId }))

  const deleteFeature = useMutation(
    trpc.feature.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Feature deleted")
        queryClient.invalidateQueries({ queryKey: trpc.feature.list.queryKey({ workspaceId }) })
      },
      onError: (error) => toast.error(error.message || "Could not delete that feature"),
    }),
  )

  const statusFilter = searchParams.get("status")?.split(",").filter(Boolean) ?? []
  const features = statusFilter.length
    ? allFeatures?.filter((feature) => statusFilter.includes(feature.status))
    : allFeatures

  return (
    <div className="flex flex-col">
      <TopBar title="Features" workspaceId={workspaceId} />

      <div className="flex flex-col gap-3 p-6">
        {statusFilter.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
              <div
                key={feature.id}
                className="group flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted"
              >
                <Link
                  href={`/workspace/${workspaceId}/features/${feature.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {feature.title}
                    </span>
                    <Timestamp date={feature.updatedAt} className="truncate text-sm text-muted-foreground" />
                  </div>
                  <StatusBadge status={feature.status} className="shrink-0" />
                </Link>

                <Dialog>
                  <DialogTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100"
                        aria-label={`Delete ${feature.title}`}
                        onClick={(event) => event.stopPropagation()}
                      />
                    }
                  >
                    <TrashIcon className="size-4" />
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete &quot;{feature.title}&quot;?</DialogTitle>
                      <DialogDescription>
                        This permanently removes the feature, its PRD, clarification history, tasks, and review
                        data. This cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="destructive"
                        onClick={() => deleteFeature.mutate({ workspaceId, featureId: feature.id })}
                        disabled={deleteFeature.isPending}
                      >
                        {deleteFeature.isPending && <SpinnerIcon className="size-4 animate-spin" />}
                        Delete
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
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
