"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { BrainIcon, PencilSimpleIcon } from "@phosphor-icons/react"

import { AlfredAvatar } from "./alfred-avatar"
import type { ConversationMessage } from "./types"

const MAX_VISIBLE_OPTIONS = 3
const CUSTOM_OPTION = "Write my own answer"

export function MessageBubble({
  message,
  interactive = false,
  showOptions = false,
  onOptionClick,
}: {
  message: ConversationMessage
  interactive?: boolean
  showOptions?: boolean
  onOptionClick?: (option: string) => void
}) {
  const [customSelected, setCustomSelected] = useState(false)
  const isAlfred = message.role === "alfred"
  const allOptions = message.options ?? null
  const options = allOptions ? allOptions.slice(0, MAX_VISIBLE_OPTIONS) : null

  if (!isAlfred) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex justify-end"
      >
        <div className="max-w-[60%] rounded-xl bg-white/70 px-4 py-3 text-sm font-semibold text-black shadow-md backdrop-blur-md">
          {message.content}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.25 }}
      className="grid grid-cols-[32px_1fr] items-start gap-3"
    >
      <AlfredAvatar icon={BrainIcon} />
      <div className="flex flex-col gap-2">
        <div className="max-w-[70%] rounded-xl bg-white/10 px-4 py-3 text-sm text-white shadow-md backdrop-blur-md">
          {message.content}
        </div>
        {/* Once the message has been answered (it's no longer the one awaiting a
            reply), the option pills disappear entirely — the chosen answer already
            lives on as its own user bubble, so there's nothing left for them to do. */}
        {options && options.length > 0 && showOptions && !customSelected && (
          <div className="flex flex-wrap items-center gap-2">
            {options.map((option) =>
              interactive ? (
                <button
                  key={option}
                  type="button"
                  onClick={() => onOptionClick?.(option)}
                  className="inline-flex w-fit items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur-md transition-colors hover:border-[#338FE6] hover:text-[#338FE6]"
                >
                  {option}
                </button>
              ) : (
                <span
                  key={option}
                  className="inline-flex w-fit items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white/60 backdrop-blur-md"
                >
                  {option}
                </span>
              ),
            )}
            {interactive ? (
              <button
                type="button"
                onClick={() => setCustomSelected(true)}
                className="inline-flex w-fit items-center gap-1 px-1 py-1.5 text-sm text-white/60 transition-colors hover:text-white"
              >
                <PencilSimpleIcon className="size-3" />
                {CUSTOM_OPTION}
              </button>
            ) : (
              <span className="inline-flex w-fit items-center gap-1 px-1 py-1.5 text-sm text-white/60">
                <PencilSimpleIcon className="size-3" />
                {CUSTOM_OPTION}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
