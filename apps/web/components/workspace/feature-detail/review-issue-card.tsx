import { CheckCircleIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export type ReviewIssue = {
  id: string
  title: string
  description: string | null
  severity: "BLOCKING" | "NON_BLOCKING"
  filePath: string | null
  lineNumber: number | null
  prdRequirementViolated: string | null
  suggestedFix: string | null
  carriedOverFromReviewNumber: number | null
}

export type Review = {
  id: string
  reviewNumber: number
  status: string
  summary: string | null
  blockingCount: number
  nonBlockingCount: number
  isLargePR: boolean
  isArchived: boolean
  resolvedFromPrevious: unknown
  criteriaCoverage: unknown
  createdAt: Date
  issues: ReviewIssue[]
}

export function IssueGroupHeader({
  label,
  count,
  tone,
}: {
  label: string
  count: number
  tone: "destructive" | "warning"
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-2 rounded-full", tone === "destructive" ? "bg-destructive" : "bg-warning")} />
      <span className={cn("text-base font-semibold", tone === "destructive" ? "text-destructive" : "text-warning")}>
        {label} ({count})
      </span>
    </div>
  )
}

export function EmptyIssueState({ label }: { label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-success/30 border-l-4 border-l-success bg-gradient-to-r from-success/10 to-transparent px-4 py-10 text-center">
      <CheckCircleIcon weight="fill" className="size-5 text-success" />
      <span className="text-base text-muted-foreground">{label}</span>
    </div>
  )
}

export function IssueCard({ issue }: { issue: ReviewIssue }) {
  const isBlocking = issue.severity === "BLOCKING"
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-l-4 bg-gradient-to-r px-4 py-3.5",
        isBlocking
          ? "border-destructive/30 border-l-destructive from-destructive/10 to-transparent"
          : "border-warning/30 border-l-warning from-warning/10 to-transparent",
      )}
    >
      {/* Title row */}
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-base font-semibold", isBlocking ? "text-destructive" : "text-warning")}>
          {issue.title}
        </span>
        {issue.carriedOverFromReviewNumber && (
          <Badge variant="outline" className="shrink-0 text-xs">
            Previously flagged in Review #{issue.carriedOverFromReviewNumber} — still present
          </Badge>
        )}
      </div>

      {/* Description */}
      {issue.description && (
        <p className="text-base leading-relaxed text-muted-foreground">{issue.description}</p>
      )}

      {/* Metadata strip */}
      {(issue.filePath || issue.prdRequirementViolated) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {issue.filePath && (
            <span className="font-mono">
              {issue.filePath}
              {issue.lineNumber ? `:${issue.lineNumber}` : ""}
            </span>
          )}
          {issue.filePath && issue.prdRequirementViolated && <span className="text-muted-foreground/40">·</span>}
          {issue.prdRequirementViolated && <span>{issue.prdRequirementViolated}</span>}
        </div>
      )}

      {/* Suggested fix */}
      {issue.suggestedFix && (
        <div className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2">
          <span className="mt-0.5 shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Fix
          </span>
          <span className="text-base text-foreground">{issue.suggestedFix}</span>
        </div>
      )}
    </div>
  )
}
