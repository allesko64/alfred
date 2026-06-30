"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { BrainIcon } from "@phosphor-icons/react"

import { AlfredAvatar } from "./alfred-avatar"

const THINKING_STAGES = ["Reading...", "Thinking...", "Considering...", "Drafting..."]

export function ThinkingBubble() {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setStage((s) => (s + 1) % THINKING_STAGES.length)
    }, 1800)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.25 }}
      className="grid grid-cols-[32px_1fr] items-start gap-3"
    >
      <AlfredAvatar pulse icon={BrainIcon} />
      <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-1.5 rounded-full bg-white/60"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
        <span className="text-sm text-white/60">{THINKING_STAGES[stage]}</span>
      </div>
    </motion.div>
  )
}
