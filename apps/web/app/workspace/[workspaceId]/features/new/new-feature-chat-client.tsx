"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeftIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { useTRPC } from "@/lib/trpc/client"
import { formatRelativeTime } from "@/lib/utils"
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input"
import { AIChatShell } from "@/components/ui/ai-chat"
import { LoaderOne } from "@/components/ui/loader"
import { MessageBubble, ThinkingBubble } from "@/components/workspace/conversation"
import type { ConversationMessage } from "@/components/workspace/conversation"

const WELCOME_MESSAGE = "Hey, I'm Alfred. Tell me about the feature you want to build"
const TRANSITION_MESSAGE = "I have everything I need, generating your PRD now..."
// Safety net: if Alfred's background reply never lands (stuck/failed job), don't
// leave the chat spinning forever — surface an error and let the user retry.
const THINKING_TIMEOUT_MS = 45_000

const INPUT_PLACEHOLDERS = [
  "Describe your feature...",
  "Add a CSV export to the dashboard",
  "Let users invite teammates by email",
  "Add dark mode to the settings page",
  "Notify me when a PR is ready for review",
]

export function NewFeatureChatClient() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const router = useRouter()
  const trpc = useTRPC()

  const [featureId, setFeatureId] = useState<string | null>(null)
  const [optimisticContent, setOptimisticContent] = useState<string | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [input, setInput] = useState("")
  const scrollAnchorRef = useRef<HTMLDivElement>(null)
  // Snapshot of how many messages existed when we started waiting, so we only
  // clear "thinking" once a genuinely new alfred message arrives — not the
  // stale one already sitting at the end of dbMessages from the prior round.
  const thinkingBaselineRef = useRef(0)

  const shouldPoll = isThinking && !!featureId

  const messagesQuery = useQuery(
    trpc.feature.getClarificationMessages.queryOptions(
      { workspaceId, featureId: featureId! },
      { enabled: !!featureId, refetchInterval: shouldPoll ? 2000 : false },
    ),
  )

  const featureQuery = useQuery(
    trpc.feature.getById.queryOptions(
      { workspaceId, featureId: featureId! },
      {
        enabled: !!featureId,
        refetchInterval: (query) => {
          const status = query.state.data?.status
          if (!status || status === "DRAFT" || status === "CLARIFYING" || status === "PRD_GENERATION") return 2000
          return false
        },
      },
    ),
  )

  const createFeature = useMutation(trpc.feature.create.mutationOptions())
  const submitReply = useMutation(trpc.feature.submitClarificationReply.mutationOptions())

  const dbMessages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data])

  // Drop the optimistic bubble once the DB has caught up with it. Checks the
  // whole list (not just the last entry) because polling can catch the user
  // message and Alfred's reply together, landing the user message anywhere
  // but last — checking only `last` left the optimistic bubble stuck forever,
  // producing a visible duplicate once the real message also rendered.
  useEffect(() => {
    if (optimisticContent && dbMessages.some((m) => m.role === "user" && m.content === optimisticContent)) {
      setOptimisticContent(null)
    }
  }, [dbMessages, optimisticContent])

  // Alfred's reply landed — stop "thinking". Only counts once a new message
  // (beyond the baseline captured at submit time) has actually arrived.
  useEffect(() => {
    const last = dbMessages[dbMessages.length - 1]
    if (isThinking && dbMessages.length > thinkingBaselineRef.current && last?.role === "alfred") {
      setIsThinking(false)
    }
  }, [dbMessages, isThinking])

  // If Alfred never replies (stuck/failed background job, credits ran out
  // mid-flight, etc.) don't leave the input locked and the spinner running
  // forever with no feedback — time out and let the user retry.
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

  // Clarification wrapped up — show the hand-off message, then redirect.
  useEffect(() => {
    const status = featureQuery.data?.status
    if (!featureId || !status || status === "DRAFT" || status === "CLARIFYING" || isTransitioning) {
      return
    }

    setIsThinking(false)
    setIsTransitioning(true)
    const timeout = setTimeout(() => {
      router.push(`/workspace/${workspaceId}/features/${featureId}/prd`)
    }, 1600)
    return () => clearTimeout(timeout)
  }, [featureQuery.data?.status, featureId, isTransitioning, router, workspaceId])

  const messages: ConversationMessage[] = useMemo(() => {
    const list: ConversationMessage[] = [{ id: "welcome", role: "alfred", content: WELCOME_MESSAGE }]
    for (const m of dbMessages) {
      list.push({
        id: m.id,
        role: m.role,
        content: m.content,
        options: (m.options as string[] | null) ?? undefined,
        createdAt: m.createdAt,
      })
    }
    if (optimisticContent) {
      list.push({ id: "optimistic", role: "user", content: optimisticContent })
    }
    return list
  }, [dbMessages, optimisticContent])

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, isThinking])

  function handleSubmitError(content: string, error: unknown) {
    setIsThinking(false)
    setOptimisticContent(null)
    // Hand the text back so the user doesn't lose what they typed and can retry.
    setInput(content)
    const message = error instanceof Error ? error.message : "Something went wrong. Please try again."
    toast.error(message)
  }

  function submitMessage(content: string) {
    if (!content || isThinking || isTransitioning) return

    setOptimisticContent(content)
    thinkingBaselineRef.current = dbMessages.length
    setIsThinking(true)
    setInput("")

    if (!featureId) {
      createFeature.mutate(
        { workspaceId, content },
        {
          onSuccess: (feature) => setFeatureId(feature.id),
          onError: (error) => handleSubmitError(content, error),
        },
      )
    } else {
      submitReply.mutate(
        { workspaceId, featureId, content },
        { onError: (error) => handleSubmitError(content, error) },
      )
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    submitMessage(input.trim())
  }

  const isBusy = isThinking || isTransitioning
  const lastMessageId = messages[messages.length - 1]?.id

  return (
    <div className="flex h-dvh flex-col items-center gap-4 overflow-hidden bg-background px-6 py-6">
      <div className="flex h-8 w-full max-w-[700px] shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`/workspace/${workspaceId}/features`)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
        </button>
        <span className="text-sm font-medium text-muted-foreground">New Feature</span>
      </div>

      <AIChatShell
        title="Alfred — New Feature"
        className="flex w-full max-w-[700px] flex-1"
        footer={
          !isTransitioning && (
            <PlaceholdersAndVanishInput
              placeholders={INPUT_PLACEHOLDERS}
              disabled={isBusy}
              isThinking={isThinking}
              onChange={(e) => setInput(e.target.value)}
              onSubmit={handleSubmit}
            />
          )
        }
      >
        <div className="flex w-full flex-col gap-2 pb-4">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => {
              const previous = messages[index - 1]
              // Tight spacing within a question/answer pair, more room before the
              // next one starts — like paragraph breaks between exchanges.
              const isNewExchange = index > 0 && message.role === "alfred" && previous?.role === "user"

              return (
                <div key={message.id} className={isNewExchange ? "pt-6" : undefined}>
                  {isNewExchange && (
                    <div className="pb-2 text-center text-[11px] text-white/40">
                      {message.createdAt ? formatRelativeTime(message.createdAt) : "Just now"}
                    </div>
                  )}
                  <MessageBubble
                    message={message}
                    interactive
                    showOptions={message.id === lastMessageId && !isBusy}
                    onOptionClick={submitMessage}
                  />
                </div>
              )
            })}
          </AnimatePresence>
          {isThinking && !isTransitioning && <ThinkingBubble />}
          <div ref={scrollAnchorRef} />
        </div>
      </AIChatShell>

      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          >
            <div className="flex w-72 flex-col items-center gap-4 rounded-xl border border-border bg-card px-8 py-8 text-center shadow-2xl">
              <LoaderOne />
              <span className="text-sm font-medium text-foreground">{TRANSITION_MESSAGE}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
