"use client"

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { animate, useMotionValue, useMotionValueEvent } from "motion/react"

import { cn } from "@/lib/utils"

type SpringConfig = {
  type: "spring"
  stiffness?: number
  damping?: number
  mass?: number
  bounce?: number
  visualDuration?: number
}

export type GooDropdownProps = {
  /** Trigger content. Width/height are measured automatically, so size it with className (e.g. "w-full" or intrinsic sizing). */
  trigger: React.ReactNode
  /** Panel content. Receives a `close` callback so items can close the menu after acting. */
  children: React.ReactNode | ((close: () => void) => React.ReactNode)
  /** Fixed pixel width of the panel (and the layout box the trigger is positioned within). */
  panelWidth: number
  align?: "start" | "end"
  /** Which side of the trigger the panel opens toward. Use "top" when the trigger sits at the bottom of the viewport. */
  side?: "bottom" | "top"
  gap?: number
  buttonRadius?: number
  panelRadius?: number
  fill?: string
  gooStrength?: number
  spring?: SpringConfig
  className?: string
  triggerClassName?: string
  panelClassName?: string
  contentPadding?: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const DEFAULT_SPRING: SpringConfig = {
  type: "spring",
  visualDuration: 0.3,
  bounce: 0.3,
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** A rounded rectangle as a CSS `shape()`, corners drawn with cubic beziers. */
function roundedRectShape(x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2))
  const k = r * 0.5523 // circle-arc bezier constant
  const x1 = x
  const y1 = y
  const x2 = x + w
  const y2 = y + h
  const p = (n: number) => `${n.toFixed(3)}px`

  return (
    `shape(from ${p(x1 + r)} ${p(y1)}, ` +
    `line to ${p(x2 - r)} ${p(y1)}, ` +
    `curve to ${p(x2)} ${p(y1 + r)} with ${p(x2 - r + k)} ${p(y1)} / ${p(x2)} ${p(y1 + r - k)}, ` +
    `line to ${p(x2)} ${p(y2 - r)}, ` +
    `curve to ${p(x2 - r)} ${p(y2)} with ${p(x2)} ${p(y2 - r + k)} / ${p(x2 - r + k)} ${p(y2)}, ` +
    `line to ${p(x1 + r)} ${p(y2)}, ` +
    `curve to ${p(x1)} ${p(y2 - r)} with ${p(x1 + r - k)} ${p(y2)} / ${p(x1)} ${p(y2 - r + k)}, ` +
    `line to ${p(x1)} ${p(y1 + r)}, ` +
    `curve to ${p(x1 + r)} ${p(y1)} with ${p(x1)} ${p(y1 + r - k)} / ${p(x1 + r - k)} ${p(y1)}, ` +
    `close)`
  )
}

function useElementSize<T extends HTMLElement>(initial: { w: number; h: number }) {
  const ref = useRef<T>(null)
  const [size, setSize] = useState(initial)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return [ref, size] as const
}

/**
 * A dropdown trigger + panel that morphs between the two shapes with a liquid
 * "goo" blend, via an SVG blur+threshold filter on the blob layer and a
 * matching CSS `shape()` clip-path on the crisp content layer.
 *
 * Trigger and panel content are measured automatically (ResizeObserver), so
 * any trigger content / panel content can be passed in — this isn't limited
 * to a fixed-size pill + flat item list.
 */
export function GooDropdown({
  trigger,
  children,
  panelWidth,
  align = "end",
  side = "bottom",
  gap = 10,
  buttonRadius = 10,
  panelRadius = 16,
  fill = "var(--popover)",
  gooStrength = 8,
  spring = DEFAULT_SPRING,
  className,
  triggerClassName,
  panelClassName,
  contentPadding = 6,
  open: openProp,
  onOpenChange,
}: GooDropdownProps) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }

  // The goo filter should only run while the trigger and panel shapes are
  // actively morphing into each other. Left on at rest, its blur radius
  // bridges the (smaller) gap between the settled trigger and panel shapes,
  // leaving a faint grey smear connecting them.
  const [isAnimating, setIsAnimating] = useState(false)

  const filterId = useId().replace(/[:]/g, "")

  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const [triggerRef, triggerSize] = useElementSize<HTMLButtonElement>({ w: 1, h: 1 })
  const [panelContentRef, panelContentSize] = useElementSize<HTMLDivElement>({ w: 0, h: 0 })

  const geo = useMemo(() => {
    const panelH = panelContentSize.h
    const btnX = align === "end" ? panelWidth - triggerSize.w : 0
    // `layerTop` positions the (larger) filter/content overlay relative to the
    // root box, which stays exactly trigger-sized so the dropdown never
    // pushes surrounding layout. Trigger/panel y below are local to that
    // overlay, sized to fully contain both shapes so the SVG goo filter's
    // region isn't clipped by an undersized box.
    const layerTop = side === "top" ? -(panelH + gap) : 0
    const triggerY = -layerTop
    const panelTop = side === "top" ? 0 : triggerSize.h + gap
    const closed = { x: btnX, y: triggerY, w: triggerSize.w, h: triggerSize.h, r: buttonRadius }
    const open = { x: 0, y: panelTop, w: panelWidth, h: panelH, r: panelRadius }
    return {
      panelTop,
      panelH,
      btnX,
      closed,
      open,
      layerTop,
      layerH: triggerSize.h + gap + panelH,
      flowH: triggerSize.h,
    }
  }, [triggerSize, panelContentSize.h, panelWidth, align, side, gap, buttonRadius, panelRadius])

  const shapeAt = useMemo(() => {
    const { closed, open } = geo
    return (t: number) =>
      roundedRectShape(
        lerp(closed.x, open.x, t),
        lerp(closed.y, open.y, t),
        lerp(closed.w, open.w, t),
        lerp(closed.h, open.h, t),
        lerp(closed.r, open.r, t),
      )
  }, [geo])

  const closedShape = shapeAt(0)

  const progress = useMotionValue(0)

  useMotionValueEvent(progress, "change", (v) => {
    const shape = shapeAt(v)
    if (panelRef.current) panelRef.current.style.clipPath = shape
    if (contentRef.current) contentRef.current.style.clipPath = shape
  })

  useEffect(() => {
    setIsAnimating(true)
    const animation = animate(progress, open ? 1 : 0, {
      ...spring,
      onComplete: () => setIsAnimating(false),
    })
    return () => animation.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, geo])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = () => setOpen(false)

  return (
    <div
      ref={rootRef}
      className={cn("relative select-none", open && "z-50", className)}
      style={{ width: panelWidth, height: geo.flowH }}
    >
      <svg className="absolute h-0 w-0" aria-hidden>
        <defs>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation={gooStrength} result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/*
        Overlay sized to fully contain both the trigger and the panel, so the
        SVG goo filter (applied below) gets a correctly sized region to work
        in — it must not be clipped to the smaller flow box above, or the
        panel renders with broken/partial opacity.
      */}
      <div
        className="pointer-events-none absolute left-0"
        style={{ top: geo.layerTop, width: panelWidth, height: geo.layerH }}
      >
        {/* goo blob layer: trigger pill + morphing panel */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ filter: isAnimating ? `url(#${filterId})` : undefined }}
        >
          <div
            className="absolute"
            style={{
              left: geo.btnX,
              top: geo.closed.y,
              width: geo.closed.w,
              height: geo.closed.h,
              borderRadius: buttonRadius,
              background: fill,
            }}
          />
          <div ref={panelRef} className="absolute inset-0" style={{ background: fill, clipPath: closedShape }} />
        </div>

        {/* crisp content layer */}
        <div className="pointer-events-none absolute inset-0">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className={cn("pointer-events-auto absolute", triggerClassName)}
            style={{ left: geo.btnX, top: geo.closed.y, borderRadius: buttonRadius }}
          >
            {trigger}
          </button>

          {/* panel content is always rendered (for measurement); the clip-path reveals it */}
          <div
            ref={contentRef}
            role="menu"
            className="absolute inset-0"
            style={{ clipPath: closedShape, pointerEvents: open ? "auto" : "none" }}
          >
            <div className="absolute inset-x-0" style={{ top: geo.panelTop, height: geo.panelH }}>
              <div ref={panelContentRef} className={cn(panelClassName)} style={{ padding: contentPadding }}>
                {typeof children === "function" ? children(close) : children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
