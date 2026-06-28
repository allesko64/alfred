"use client"

import { motion } from "framer-motion"

import { AlfredAvatar } from "./alfred-avatar"
import type { ConversationMessage } from "./types"

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
  const isAlfred = message.role === "alfred"
  const options = message.options ?? null

  if (!isAlfred) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] rounded-lg bg-card px-4 py-3 text-sm text-foreground">
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
      className="grid grid-cols-[28px_1fr] items-start gap-3"
    >
      <AlfredAvatar />
      <div className="flex flex-col gap-2">
        <div className="max-w-[85%] rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
          {message.content}
        </div>
        {options && options.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {options.map((option) =>
              interactive ? (
                <button
                  key={option}
                  type="button"
                  disabled={!showOptions}
                  onClick={() => onOptionClick?.(option)}
                  className="rounded-full bg-muted px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
                >
                  {option}
                </button>
              ) : (
                <span
                  key={option}
                  className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground"
                >
                  {option}
                </span>
              ),
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
