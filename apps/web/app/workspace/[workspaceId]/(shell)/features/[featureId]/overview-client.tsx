"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { BrainIcon, CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { formatRelativeTime } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { LoaderFive } from "@/components/ui/loader"
import { AlfredAvatar, MessageBubble } from "@/components/workspace/conversation"
import type { ConversationMessage } from "@/components/workspace/conversation"

export function OverviewClient() {
  const { workspaceId, featureId } = useParams<{ workspaceId: string; featureId: string }>()
  const router = useRouter()
  const trpc = useTRPC()

  const { data: feature } = useQuery(trpc.feature.getById.queryOptions({ workspaceId, featureId }))
  const { data: messages, isLoading } = useQuery(
    trpc.feature.getClarificationMessages.queryOptions({ workspaceId, featureId }),
  )

  const isWritingPRD = feature?.status === "PRD_GENERATION"
  const isRejected = feature?.status === "REJECTED"

  const { data: progress } = useQuery(
    trpc.feature.getWorkflowProgress.queryOptions(
      { workspaceId, featureId },
      { enabled: isWritingPRD, refetchInterval: isWritingPRD ? 2000 : false },
    ),
  )

  // Once generation finishes, show a brief success state before handing off
  // to the PRD page — avoids a manual "your PRD is ready" button entirely.
  const wasWritingRef = useRef(false)
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    if (isWritingPRD) {
      wasWritingRef.current = true
      return
    }
    if (wasWritingRef.current && feature && !isRejected) {
      wasWritingRef.current = false
      setRedirecting(true)
      const timeout = setTimeout(() => {
        router.push(`/workspace/${workspaceId}/features/${featureId}/prd`)
      }, 1400)
      return () => clearTimeout(timeout)
    }
  }, [isWritingPRD, feature, isRejected, router, workspaceId, featureId])

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

      <AnimatePresence>
        {(isWritingPRD || redirecting) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          >
            <div className="flex w-72 flex-col items-center gap-4 rounded-xl border border-border bg-card px-8 py-8 text-center shadow-2xl">
              {redirecting ? (
                <>
                  <div className="flex size-12 items-center justify-center rounded-full bg-success text-success-foreground">
                    <CheckCircleIcon className="size-6" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    Your PRD is ready — taking you there now...
                  </span>
                </>
              ) : (
                <>
                  <AlfredAvatar pulse icon={BrainIcon} />
                  <div className="flex w-full flex-col gap-2">
                    <LoaderFive text={progress?.progressMessage ?? "Alfred is writing your PRD..."} />
                    <Progress value={progress?.progressPercent ?? 10} />
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {feature && isRejected && (
        <div className="flex w-full max-w-[700px] items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-4">
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-destructive">PRD generation was blocked</span>
            <span className="text-sm text-muted-foreground">{feature.rejectionReason}</span>
          </div>
        </div>
      )}
    </div>
  )
}
