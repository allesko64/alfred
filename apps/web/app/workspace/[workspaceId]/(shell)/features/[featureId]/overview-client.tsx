"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { BrainIcon, CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { useTRPC } from "@/lib/trpc/client"
import { formatRelativeTime } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { LoaderFive } from "@/components/ui/loader"
import { AIChatShell } from "@/components/ui/ai-chat"
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input"
import { AlfredAvatar, ConfirmedTranscript, MessageBubble } from "@/components/workspace/conversation"
import type { ConversationMessage } from "@/components/workspace/conversation"

// Feature statuses reached only after the PRD has actually been generated —
// clarification is a settled, signed-off record at this point, not a paused
// chat. Anything before this (including PRD_GENERATION, still in flight)
// keeps the live chat UI.
const CONFIRMED_STATUSES = new Set([
  "PRD_READY",
  "TASK_GENERATION",
  "PLANNING",
  "IN_DEVELOPMENT",
  "PR_LINKED",
  "REVIEWING",
  "CHANGES_REQUESTED",
  "RE_REVIEWING",
  "REVIEW_PASSED",
  "PENDING_APPROVAL",
  "SHIPPED",
])

// Safety net: if Alfred's background reply never lands (stuck/failed job), don't
// leave the chat spinning forever — surface an error and let the user retry.
const THINKING_TIMEOUT_MS = 45_000

const INPUT_PLACEHOLDERS = [
  "Type your answer...",
  "Add a CSV export to the dashboard",
  "Let users invite teammates by email",
  "Add dark mode to the settings page",
]

export function OverviewClient() {
  const { workspaceId, featureId } = useParams<{ workspaceId: string; featureId: string }>()
  const router = useRouter()
  const trpc = useTRPC()

  const [optimisticContent, setOptimisticContent] = useState<string | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [input, setInput] = useState("")
  const thinkingBaselineRef = useRef(0)

  const { data: feature } = useQuery(
    trpc.feature.getById.queryOptions(
      { workspaceId, featureId },
      {
        refetchInterval: (query) => {
          const status = query.state.data?.status
          const stillInFlight = status === undefined || status === "CLARIFYING" || status === "PRD_GENERATION"
          return isThinking || stillInFlight ? 2000 : false
        },
      },
    ),
  )

  const isClarifying = feature?.status === "CLARIFYING"
  const isConfirmed = !!feature && CONFIRMED_STATUSES.has(feature.status)
  const shouldPoll = isThinking || isClarifying

  const { data: dbMessages, isLoading } = useQuery(
    trpc.feature.getClarificationMessages.queryOptions(
      { workspaceId, featureId },
      { refetchInterval: shouldPoll ? 2000 : false },
    ),
  )

  const submitReply = useMutation(trpc.feature.submitClarificationReply.mutationOptions())

  const isWritingPRD = feature?.status === "PRD_GENERATION"
  const isRejected = feature?.status === "REJECTED"

  const { data: progress } = useQuery(
    trpc.feature.getWorkflowProgress.queryOptions(
      { workspaceId, featureId },
      { enabled: isWritingPRD, refetchInterval: isWritingPRD ? 2000 : false },
    ),
  )

  const messages = useMemo(() => {
    const list = dbMessages ?? []
    if (!optimisticContent) return list
    return [
      ...list,
      {
        id: "optimistic",
        role: "user" as const,
        content: optimisticContent,
        options: null,
        createdAt: new Date(),
      },
    ]
  }, [dbMessages, optimisticContent])

  // Drop the optimistic bubble once the DB has caught up with it. Checks the
  // whole list (not just the last entry) since polling can land the user
  // message and Alfred's reply together — checking only the last message
  // would leave the optimistic bubble stuck, producing a visible duplicate.
  useEffect(() => {
    if (optimisticContent && dbMessages?.some((m) => m.role === "user" && m.content === optimisticContent)) {
      setOptimisticContent(null)
    }
  }, [dbMessages, optimisticContent])

  // Alfred's reply landed — stop "thinking". Only counts once a new message
  // (beyond the baseline captured at submit time) has actually arrived.
  useEffect(() => {
    const list = dbMessages ?? []
    const last = list[list.length - 1]
    if (isThinking && list.length > thinkingBaselineRef.current && last?.role === "alfred") {
      setIsThinking(false)
    }
  }, [dbMessages, isThinking])

  // Safety net: don't leave the input locked and spinner running forever if
  // Alfred's background reply never lands.
  useEffect(() => {
    if (!isThinking) return
    const timeout = setTimeout(() => {
      setIsThinking(false)
      setOptimisticContent((content) => {
        if (content) setInput(content)
        return null
      })
      toast.error("Alfred is taking longer than expected to reply. Please try again.")
    }, THINKING_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [isThinking])

  function submitMessage(content: string) {
    if (!content || isThinking) return

    setOptimisticContent(content)
    thinkingBaselineRef.current = (dbMessages ?? []).length
    setIsThinking(true)
    setInput("")

    submitReply.mutate(
      { workspaceId, featureId, content },
      {
        onError: (error) => {
          setIsThinking(false)
          setOptimisticContent(null)
          setInput(content)
          toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.")
        },
      },
    )
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    submitMessage(input.trim())
  }

  const lastMessageId = messages[messages.length - 1]?.id

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
      {isConfirmed ? (
        isLoading ? (
          <Skeleton className="h-32 w-full max-w-[700px]" />
        ) : (
          <ConfirmedTranscript
            messages={messages.map(
              (message) =>
                ({
                  id: message.id,
                  role: message.role,
                  content: message.content,
                  options: message.options as string[] | null,
                  createdAt: message.createdAt,
                }) satisfies ConversationMessage,
            )}
            decisionPills={feature?.decisionPills ?? null}
          />
        )
      ) : (
        <AIChatShell
          title="Alfred — Conversation"
          className="h-[640px] w-full max-w-[700px]"
          footer={
            isClarifying && (
              <PlaceholdersAndVanishInput
                placeholders={INPUT_PLACEHOLDERS}
                disabled={isThinking}
                isThinking={isThinking}
                onChange={(e) => setInput(e.target.value)}
                onSubmit={handleSubmit}
              />
            )
          }
        >
          <div className="flex w-full flex-col gap-2">
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              messages.map((message, index) => {
                const previous = messages[index - 1]
                const isNewExchange = index > 0 && message.role === "alfred" && previous?.role === "user"

                return (
                  <div key={message.id} className={isNewExchange ? "pt-6" : undefined}>
                    {isNewExchange && (
                      <div className="pb-2 text-center text-[11px] text-white/40">
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
                      interactive={isClarifying}
                      showOptions={isClarifying && message.id === lastMessageId && !isThinking}
                      onOptionClick={submitMessage}
                    />
                  </div>
                )
              })
            )}
          </div>
        </AIChatShell>
      )}

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
