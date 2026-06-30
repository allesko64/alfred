"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

const PARTICLE_COUNT = 20

/**
 * Dark glass "AI chat" chrome — animated rotating border, drifting gradient
 * background, and floating particles. Wrap any message list / input around
 * it to get the same look on every AI chat surface in the product.
 */
export function AIChatShell({
  title,
  headerLeft,
  footer,
  className,
  contentClassName,
  children,
}: {
  title: string
  headerLeft?: ReactNode
  footer?: ReactNode
  className?: string
  contentClassName?: string
  children: ReactNode
}) {
  // Randomized client-side only, after mount — Math.random() during the
  // server render would produce values that differ from the client's first
  // render and trigger a hydration mismatch, so particles start empty and
  // are filled in once we're safely in the browser.
  const [particles, setParticles] = useState<
    { left: number; driftX: [number, number]; duration: number }[]
  >([])

  useEffect(() => {
    setParticles(
      Array.from({ length: PARTICLE_COUNT }).map(() => ({
        left: Math.random() * 100,
        driftX: [Math.random() * 200 - 100, Math.random() * 200 - 100] as [number, number],
        duration: 5 + Math.random() * 3,
      })),
    )
  }, [])

  return (
    // contain: paint forces a hard clip boundary for the rotating border below —
    // without it, framer-motion's will-change:transform can promote that child to
    // its own compositing layer and Chromium lets the rotated corners (which sweep
    // well past these bounds — radius = half the box diagonal) paint outside the
    // rounded-2xl + overflow-hidden clip.
    <div
      className={cn("relative isolate w-full overflow-hidden rounded-2xl p-[2px]", className)}
      style={{ contain: "paint" }}
    >
      <motion.div
        className="absolute inset-0 rounded-2xl border-2 border-white/20"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-black/90 backdrop-blur-xl">
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-gray-800 via-black to-gray-900"
          animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ backgroundSize: "200% 200%" }}
        />

        {particles.map((particle, i) => (
          <motion.div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-white/10"
            animate={{ y: ["0%", "-140%"], x: particle.driftX, opacity: [0, 1, 0] }}
            transition={{ duration: particle.duration, repeat: Infinity, delay: i * 0.5, ease: "easeInOut" }}
            style={{ left: `${particle.left}%`, bottom: "-10%" }}
          />
        ))}

        <div className="relative z-10 flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
          {headerLeft}
          <h2 className="text-sm font-semibold text-white">{title}</h2>
        </div>

        <div className={cn("relative z-10 flex-1 overflow-y-auto px-4 py-3", contentClassName)}>
          {children}
        </div>

        {footer && <div className="dark relative z-10 shrink-0 border-t border-white/10 p-3">{footer}</div>}
      </div>
    </div>
  )
}
