"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { CaretDownIcon, CheckCircleIcon } from "@phosphor-icons/react"

import { formatRelativeTime } from "@/lib/utils"
import { DecisionPills } from "./decision-pills"
import type { ConversationMessage } from "./types"

interface QAPair {
  question: ConversationMessage
  answer?: ConversationMessage
}

function pairMessages(messages: ConversationMessage[]): QAPair[] {
  const pairs: QAPair[] = []
  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i]
    if (!message || message.role !== "alfred") continue
    const next = messages[i + 1]
    const answer = next?.role === "user" ? next : undefined
    pairs.push({ question: message, answer })
    if (answer) i += 1
  }
  return pairs
}

/**
 * Read-only "signed document" view of a finished clarification conversation —
 * replaces the live chat bubbles once a feature has moved past PRD_GENERATION.
 * No input box, no hover states, no per-message timestamps: this is a record
 * of decisions already made, not a paused conversation.
 */
export function ConfirmedTranscript({
  messages,
  decisionPills,
}: {
  messages: ConversationMessage[]
  decisionPills: string[] | null
}) {
  const [expanded, setExpanded] = useState(false)
  const pairs = pairMessages(messages)
  const confirmedAt = messages[messages.length - 1]?.createdAt
  const pills = decisionPills ?? []

  return (
    <div className="w-full max-w-[700px] overflow-hidden rounded-xl border border-white/10 bg-[#090909]">
      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircleIcon weight="fill" className="size-5 shrink-0 text-green-500" />
            <span className="text-sm font-medium text-[#fafafa]">Clarification complete</span>
          </div>
          {confirmedAt && (
            <span className="shrink-0 text-xs text-[#71717a]">
              {formatRelativeTime(confirmedAt)}
            </span>
          )}
        </div>

        {pills.length > 0 && <DecisionPills pills={pills} variant="chips" />}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-fit items-center gap-1.5 text-xs text-[#71717a] transition-colors hover:text-[#fafafa]"
        >
          <CaretDownIcon
            className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          {expanded ? "Hide" : "View"} {pairs.length} question{pairs.length === 1 ? "" : "s"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4 border-t border-white/10 px-6 py-5">
              {pairs.map(({ question, answer }) => (
                <div key={question.id} className="border-l-2 border-[#0075DE] pl-3">
                  <p className="text-[13px] leading-snug text-[#71717a]">{question.content}</p>
                  {answer && (
                    <p className="text-[14px] leading-snug font-medium text-[#fafafa]">
                      {answer.content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
