"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"

interface WorkspaceEvent {
  type: string
  featureId?: string
}

/** Subscribes to the workspace's SSE stream and invalidates the relevant tRPC queries on each Inngest workflow update, so the UI refreshes without polling. */
export function useWorkspaceEvents(workspaceId: string) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  useEffect(() => {
    const source = new EventSource(`/api/sse/${workspaceId}`)

    source.onmessage = (event) => {
      let payload: WorkspaceEvent
      try {
        payload = JSON.parse(event.data)
      } catch {
        return
      }

      if (payload.type !== "workflow_run.updated") return

      queryClient.invalidateQueries({ queryKey: trpc.feature.getWorkflowProgress.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.feature.getById.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.review.getWorkflowStatus.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.review.getByFeature.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.notification.getUnread.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.notification.getWorkspaceActivity.queryKey() })
    }

    return () => source.close()
  }, [workspaceId, queryClient, trpc])
}
