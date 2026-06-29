"use client"

import { useWorkspaceEvents } from "@/hooks/use-workspace-events"

export function WorkspaceEventsListener({ workspaceId }: { workspaceId: string }) {
  useWorkspaceEvents(workspaceId)
  return null
}
