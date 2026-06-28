import { useEffect, useRef, useState } from "react"

const DURATION_MS = 600

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export function useCountUp(value: number | undefined) {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    if (value === undefined) return

    const from = fromRef.current
    const to = value
    const start = performance.now()
    let frame: number

    const tick = (now: number) => {
      const progress = Math.min((now - start) / DURATION_MS, 1)
      setDisplay(Math.round(from + (to - from) * easeOut(progress)))
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return display
}
