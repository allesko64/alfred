"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { WarningCircleIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { formatRelativeTime } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { AlfredAvatar, MessageBubble } from "@/components/workspace/conversation"
import type { ConversationMessage } from "@/components/workspace/conversation"
import { NextStepLink } from "@/components/workspace/feature-detail/next-step-link"
import { useSetFeatureHeaderAction } from "@/components/workspace/feature-detail/feature-header-actions"

export function OverviewClient() {
  const { workspaceId, featureId } = useParams<{ workspaceId: string; featureId: string }>()
  const trpc = useTRPC()

  const { data: feature } = useQuery(trpc.feature.getById.queryOptions({ workspaceId, featureId }))
  const { data: messages, isLoading } = useQuery(
    trpc.feature.getClarificationMessages.queryOptions({ workspaceId, featureId }),
  )

  const isWritingPRD = feature?.status === "PRD_GENERATION"
  const isRejected = feature?.status === "REJECTED"
  const isPRDReady =
    !!feature &&
    feature.status !== "DRAFT" &&
    feature.status !== "CLARIFYING" &&
    feature.status !== "PRD_GENERATION" &&
    feature.status !== "REJECTED"

  const { data: progress } = useQuery(
    trpc.feature.getWorkflowProgress.queryOptions(
      { workspaceId, featureId },
      { enabled: isWritingPRD, refetchInterval: isWritingPRD ? 2000 : false },
    ),
  )

  useSetFeatureHeaderAction(
    useMemo(() => {
      if (!isPRDReady) return null
      return (
        <NextStepLink
          href={`/workspace/${workspaceId}/features/${featureId}/prd`}
          label={feature?.approvedAt ? "View your PRD" : "Your PRD is ready"}
        />
      )
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPRDReady, feature?.approvedAt, workspaceId, featureId]),
  )

  return (
    // items-center centers the conversation column within this content area,
    // which already excludes the sidebar (shell layout offsets with pl-60) —
    // so this centers relative to the content area, not the full viewport.
    <div className="flex flex-col items-center gap-6 py-6">
      <div className="flex w-full max-w-[700px] flex-col gap-2">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          messages?.map((message, index) => {
            const previous = messages[index - 1]
            const isNewExchange = index > 0 && message.role === "alfred" && previous?.role === "user"

            return (
              <div key={message.id} className={isNewExchange ? "pt-6" : undefined}>
                {isNewExchange && (
                  <div className="pb-2 text-center text-[11px] text-muted-foreground/60">
                    {formatRelativeTime(message.createdAt)}
                  </div>
                )}
                <MessageBubble
                  message={{
                    id: message.id,
                    role: message.role,
                    content: message.content,
                    options: message.options as string[] | null,
                    createdAt: message.createdAt,
                  } satisfies ConversationMessage}
                />
              </div>
            )
          })
        )}
      </div>

      {isWritingPRD && (
        <div className="flex w-full max-w-[700px] items-center gap-4 rounded-lg bg-muted px-4 py-4">
          <AlfredAvatar pulse />
          <div className="flex flex-1 flex-col gap-2">
            <span className="text-sm text-foreground">
              {progress?.progressMessage ?? "Alfred is writing your PRD..."}
            </span>
            <Progress value={progress?.progressPercent ?? 10} />
          </div>
        </div>
      )}

      {feature && isRejected && (
        <div className="flex w-full max-w-[700px] items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-4">
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-destructive">PRD generation was blocked</span>
            <span className="text-xs text-muted-foreground">{feature.rejectionReason}</span>
          </div>
        </div>
      )}
    </div>
  )
}
