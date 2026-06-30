"use client"

import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import Link from "next/link"
import { Ear, Wand2, Map as MapIcon, ShieldCheck, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LayoutTextFlip } from "@/components/ui/layout-text-flip"
import { BackgroundRippleEffect } from "@/components/ui/background-ripple-effect"
import { AnimatedTooltip } from "@/components/ui/animated-tooltip"

const PHASES = [
  { word: "Listens", color: "#F59E0B", icon: Ear, designation: "Understands your requirements" },
  { word: "Crafts", color: "#38BDF8", icon: Wand2, designation: "Drafts the product spec" },
  { word: "Maps", color: "#A78BFA", icon: MapIcon, designation: "Plans the implementation" },
  { word: "Audits", color: "#FB923C", icon: ShieldCheck, designation: "Reviews for quality & risk" },
  { word: "Ships", color: "#34D399", icon: Rocket, designation: "Deploys to production" },
] as const

const TOOLTIP_ITEMS = PHASES.map((p, index) => ({
  id: index + 1,
  name: p.word,
  designation: p.designation,
  icon: p.icon,
  color: p.color,
}))

const ROTATION_INTERVAL_MS = 2800

function FadeIn({
  delay,
  className,
  children,
}: {
  delay: number
  className?: string
  children: React.ReactNode
}) {
  const prefersReducedMotion = useReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function Hero() {
  const [currentPhase, setCurrentPhase] = useState(0)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhase((phase) => (phase + 1) % PHASES.length)
    }, ROTATION_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative min-h-screen bg-background pt-16 overflow-hidden">
      <BackgroundRippleEffect rows={9} />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, hsl(var(--primary) / 0.15), transparent)",
        }}
      />

      <div className="relative max-w-4xl mx-auto px-6 flex flex-col items-center text-center pt-24 pb-16">

        <FadeIn delay={0.0} className="flex flex-row items-center justify-center mt-4">
          <AnimatedTooltip items={TOOLTIP_ITEMS} />
        </FadeIn>

        <FadeIn delay={0.1} className="mt-8">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight text-foreground flex flex-wrap items-center justify-center gap-x-3 gap-y-3">
            <span>Describe what you want. Alfred</span>
            <LayoutTextFlip
              words={PHASES.map((p) => p.word)}
              colors={PHASES.map((p) => p.color)}
              duration={ROTATION_INTERVAL_MS}
              className="rounded-4xl px-4 py-1 min-w-[160px] leading-normal"
            />
            <span>.</span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.3} className="flex gap-2 justify-center mt-4">
          {PHASES.map((p, index) => (
            <span
              key={p.word}
              className={`rounded-full transition-all duration-300 ${
                index === currentPhase ? "w-2 h-2" : "w-1.5 h-1.5 bg-foreground/20"
              }`}
              style={
                index === currentPhase ? { backgroundColor: p.color } : undefined
              }
            />
          ))}
        </FadeIn>

        <FadeIn delay={0.4} className="mt-6">
          <p className="text-xl md:text-2xl text-foreground/60 font-normal max-w-xl mx-auto text-center leading-relaxed">
            Your AI co-pilot for the entire feature lifecycle.
          </p>
        </FadeIn>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
          <FadeIn delay={0.5}>
            <Button variant="default" size="lg" className="rounded-md group font-bold text-lg"
            
              render={<Link href="/signup" />} nativeButton={false}>
              Start building 
              <span className="ml-1 inline-block transition-transform duration-150 group-hover:translate-x-[3px]">
                →
              </span>
            </Button>
          </FadeIn>
          <FadeIn delay={0.58}>
            <Button
              variant="outline"
              size="lg"
              className="rounded-md font-bold text-lg border-foreground/20 text-foreground/80 hover:text-foreground hover:border-foreground/50 bg-transparent hover:bg-transparent"
            >
              See how it works
            </Button>
          </FadeIn>
        </div>

        <motion.div
          id="how-it-works"
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6, ease: "easeOut" }}
          className="relative w-full max-w-5xl mx-auto mt-16 scroll-mt-24"
        >
          <div
            className="absolute inset-0 pointer-events-none -z-10"
            style={{
              background:
                "radial-gradient(ellipse 60% 40% at 50% 100%, hsl(var(--primary) / 0.25), transparent)",
            }}
          />

          <div
            className="rounded-xl overflow-hidden"
            style={{
              boxShadow:
                "0 0 0 1px hsl(var(--foreground) / 0.08), 0 32px 80px rgba(0,0,0,0.6)",
            }}
          >
            <div className="h-9 bg-muted rounded-t-xl border-b border-border flex items-center px-4 gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
              <span className="ml-auto mr-auto bg-foreground/5 rounded-full px-3 py-0.5 text-sm text-foreground/30">
                app.alfred.ai
              </span>
            </div>
            <div
              className="relative bg-card rounded-b-xl h-[480px] md:h-[540px] flex items-center justify-center"
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse 60% 60% at 50% 50%, hsl(var(--primary) / 0.05), transparent)",
                }}
              />
              <p className="relative text-muted-foreground text-lg italic">
                Demo video coming soon
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
