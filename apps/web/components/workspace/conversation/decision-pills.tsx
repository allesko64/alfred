import { cn } from "@/lib/utils"

/**
 * Renders the same extracted-decision data (feature.decisionPills) in two
 * shapes: bordered chips for the confirmed-transcript summary card, and
 * inline text for the PRD "Planning against" header — same source of truth,
 * different visual role per surface.
 */
export function DecisionPills({
  pills,
  variant = "chips",
  className,
}: {
  pills: string[]
  variant?: "chips" | "inline"
  className?: string
}) {
  if (pills.length === 0) return null

  if (variant === "inline") {
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>
        Planning against:{" "}
        {pills.map((pill, index) => (
          <span key={pill}>
            <span className="font-medium text-foreground">{pill}</span>
            {index < pills.length - 1 && (
              <span className="mx-1.5 text-muted-foreground/50">·</span>
            )}
          </span>
        ))}
      </span>
    )
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {pills.map((pill) => (
        <span
          key={pill}
          className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-[#fafafa]"
        >
          {pill}
        </span>
      ))}
    </div>
  )
}
