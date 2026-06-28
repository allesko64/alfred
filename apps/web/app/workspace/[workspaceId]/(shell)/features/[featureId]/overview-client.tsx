"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowRightIcon, WarningCircleIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { AlfredAvatar, MessageBubble } from "@/components/workspace/conversation"
import type { ConversationMessage } from "@/components/workspace/conversation"

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

  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="flex max-w-[700px] flex-col gap-6">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          messages?.map((message) => (
            <MessageBubble
              key={message.id}
              message={{
                id: message.id,
                role: message.role,
                content: message.content,
                options: message.options as string[] | null,
              } satisfies ConversationMessage}
            />
          ))
        )}
      </div>

      {isWritingPRD && (
        <div className="flex max-w-[700px] items-center gap-4 rounded-lg bg-muted px-4 py-4">
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
        <div className="flex max-w-[700px] items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-4">
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-destructive">PRD generation was blocked</span>
            <span className="text-xs text-muted-foreground">{feature.rejectionReason}</span>
          </div>
        </div>
      )}

      {isPRDReady && (
        <Link
          href={`/workspace/${workspaceId}/features/${featureId}/prd`}
          className="flex max-w-[700px] items-center justify-between gap-3 rounded-lg border-l-2 border-l-primary bg-card px-4 py-4 hover:bg-muted"
        >
          <span className="text-sm font-medium text-foreground">Your PRD is ready</span>
          <ArrowRightIcon className="size-4 text-primary" />
        </Link>
      )}
    </div>
  )
}
