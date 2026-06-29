"use client"

import { motion } from "motion/react"

export function LoaderFive({ text }: { text: string }) {
  return (
    <div className="relative">
      <motion.span
        initial={{ backgroundPosition: "0% 50%" }}
        animate={{ backgroundPosition: ["0%", "100%", "0%"] }}
        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        style={{
          backgroundImage:
            "linear-gradient(90deg, var(--muted-foreground) 0%, var(--muted-foreground) 35%, var(--foreground) 50%, var(--muted-foreground) 65%, var(--muted-foreground) 100%)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
        className="text-center text-sm font-medium tracking-wide"
      >
        {text}
      </motion.span>
    </div>
  )
}
