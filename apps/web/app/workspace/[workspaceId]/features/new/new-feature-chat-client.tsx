"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeftIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input"
import { AlfredLogo } from "@/components/icons/alfred-logo"
import { MessageBubble, ThinkingBubble } from "@/components/workspace/conversation"
import type { ConversationMessage } from "@/components/workspace/conversation"

const WELCOME_MESSAGE = "Hey, I'm Alfred. Tell me about the feature you want to build"
const TRANSITION_MESSAGE = "I have everything I need, generating your PRD now..."

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
      { enabled: !!featureId, refetchInterval: shouldPoll ? 2000 : false },
    ),
  )

  const createFeature = useMutation(trpc.feature.create.mutationOptions())
  const submitReply = useMutation(trpc.feature.submitClarificationReply.mutationOptions())

  const dbMessages = messagesQuery.data ?? []

  // Drop the optimistic bubble once the DB has caught up with it.
  useEffect(() => {
    const last = dbMessages[dbMessages.length - 1]
    if (optimisticContent && last?.role === "user" && last.content === optimisticContent) {
      setOptimisticContent(null)
    }
  }, [dbMessages, optimisticContent])

  // Alfred's reply landed — stop "thinking".
  useEffect(() => {
    const last = dbMessages[dbMessages.length - 1]
    if (isThinking && last?.role === "alfred") {
      setIsThinking(false)
    }
  }, [dbMessages, isThinking])

  // Clarification wrapped up — show the hand-off message, then redirect.
  useEffect(() => {
    const status = featureQuery.data?.status
    if (!featureId || !status || status === "DRAFT" || status === "CLARIFYING" || isTransitioning) {
      return
    }

    setIsThinking(false)
    setIsTransitioning(true)
    const timeout = setTimeout(() => {
      router.push(`/workspace/${workspaceId}/features/${featureId}`)
    }, 1600)
    return () => clearTimeout(timeout)
  }, [featureQuery.data?.status, featureId, isTransitioning, router, workspaceId])

  const messages: ConversationMessage[] = useMemo(() => {
    const list: ConversationMessage[] = [{ id: "welcome", role: "alfred", content: WELCOME_MESSAGE }]
    for (const m of dbMessages) {
      list.push({ id: m.id, role: m.role, content: m.content, options: (m.options as string[] | null) ?? undefined })
    }
    if (optimisticContent) {
      list.push({ id: "optimistic", role: "user", content: optimisticContent })
    }
    if (isTransitioning) {
      list.push({ id: "transition", role: "alfred", content: TRANSITION_MESSAGE })
    }
    return list
  }, [dbMessages, optimisticContent, isTransitioning])

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, isThinking])

  function submitMessage(content: string) {
    if (!content || isThinking || isTransitioning) return

    setOptimisticContent(content)
    setIsThinking(true)
    setInput("")

    if (!featureId) {
      createFeature.mutate(
        { workspaceId, content },
        { onSuccess: (feature) => setFeatureId(feature.id) },
      )
    } else {
      submitReply.mutate({ workspaceId, featureId, content })
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    submitMessage(input.trim())
  }

  const isBusy = isThinking || isTransitioning
  const lastMessageId = messages[messages.length - 1]?.id

  return (
    <motion.div
      animate={isTransitioning ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: 0.6, delay: isTransitioning ? 1 : 0 }}
      className="flex min-h-screen flex-col bg-background"
    >
      <div className="flex h-14 shrink-0 items-center gap-3 px-6">
        <button
          type="button"
          onClick={() => router.push(`/workspace/${workspaceId}/features`)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
        </button>
        <AlfredLogo className="size-6 text-foreground" />
        <span className="text-xs text-muted-foreground">New Feature</span>
      </div>

      <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-10">
        <div className="flex w-full max-w-[700px] flex-1 flex-col justify-center gap-6">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                interactive
                showOptions={message.id === lastMessageId && !isBusy}
                onOptionClick={submitMessage}
              />
            ))}
          </AnimatePresence>
          {isThinking && !isTransitioning && <ThinkingBubble />}
          <div ref={scrollAnchorRef} />
        </div>
      </div>

      {!isTransitioning && (
        <div className="flex flex-col items-center gap-2 px-6 pt-12 pb-6">
          <div className="w-full max-w-[700px]">
            <PlaceholdersAndVanishInput
              placeholders={INPUT_PLACEHOLDERS}
              disabled={isBusy}
              onChange={(e) => setInput(e.target.value)}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      )}
    </motion.div>
  )
}
