"use client"

import { useRef, useState } from "react"
import { motion } from "motion/react"

// Every icon state is built from two 4-point shapes (M, L, L, L, Z) so the
// path command structure stays identical and motion can interpolate `d`
// smoothly between states.

// The play triangle is split down its vertical midline into two
// quadrilaterals, so each pause bar morphs into one half of the triangle.
const PAUSE = {
  left: "M5 5L9 5L9 19L5 19Z",
  right: "M15 5L19 5L19 19L15 19Z",
} as const

const PLAY = {
  // top-left, top-mid, bottom-mid, bottom-left
  left: "M7 5L13 8.5L13 15.5L7 19Z",
  // top-mid, apex, apex, bottom-mid (two corners collapse to the apex)
  right: "M13 8.5L19 12L19 12L13 15.5Z",
} as const

// Sound uses the same trick beside a static speaker body: two vertical
// volume bars morph into the two diagonal strokes of a mute cross.
const SOUND_ON = {
  left: "M14.5 10L16 10L16 14L14.5 14Z",
  right: "M18.5 7.5L20 7.5L20 16.5L18.5 16.5Z",
} as const

const SOUND_OFF = {
  left: "M14.4 8.9L15.6 8.1L20.6 15.1L19.4 15.9Z",
  right: "M19.4 8.1L20.6 8.9L15.6 15.9L14.4 15.1Z",
} as const

const SPEAKER_BODY = "M4 9.5L7.5 9.5L11.5 5.5L11.5 18.5L7.5 14.5L4 14.5Z"

const SPRING = {
  type: "spring",
  stiffness: 260,
  damping: 26,
  mass: 0.9,
} as const

function MorphIcon({
  target,
  staticPath,
  size = 24,
}: {
  target: { left: string; right: string }
  staticPath?: string
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {staticPath && <path d={staticPath} />}
      <motion.path animate={{ d: target.left }} transition={SPRING} initial={false} />
      <motion.path animate={{ d: target.right }} transition={SPRING} initial={false} />
    </svg>
  )
}

function ControlButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`pointer-events-auto flex items-center justify-center rounded-full bg-background/70 text-foreground shadow-lg backdrop-blur-sm transition-transform duration-150 hover:scale-105 active:scale-95 ${className ?? ""}`}
    >
      {children}
    </button>
  )
}

export function DemoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-b-xl bg-card">
      <video
        ref={videoRef}
        src="/alfred-demo.mp4"
        poster="/alfred-demo-poster.jpg"
        preload="metadata"
        playsInline
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        className="h-full w-full cursor-pointer object-cover"
      />

      {/* Controls sit above the video but let clicks through to it elsewhere.
          While playing they fade out and return on hover. */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
          isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"
        }`}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <ControlButton
            label={isPlaying ? "Pause" : "Play"}
            onClick={togglePlay}
            className="size-20"
          >
            <MorphIcon target={isPlaying ? PAUSE : PLAY} size={36} />
          </ControlButton>
        </div>

        <ControlButton
          label={isMuted ? "Unmute" : "Mute"}
          onClick={toggleMute}
          className="absolute right-4 bottom-4 size-11"
        >
          <MorphIcon
            target={isMuted ? SOUND_OFF : SOUND_ON}
            staticPath={SPEAKER_BODY}
            size={22}
          />
        </ControlButton>
      </div>
    </div>
  )
}
