import { cn } from "@/lib/utils"
import { Badge, type badgeVariants } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"]

type StatusMeta = {
  badgeVariant: BadgeVariant
  dotColor: string
  pulse: boolean
  showDot?: boolean
}

// Feature statuses and PR statuses never collide, so they share one map.
const STATUS_META: Record<string, StatusMeta> = {
  DRAFT: { badgeVariant: "outline", dotColor: "bg-muted-foreground", pulse: false },
  CLARIFYING: { badgeVariant: "secondary", dotColor: "bg-primary", pulse: true },
  PRD_GENERATION: { badgeVariant: "secondary", dotColor: "bg-primary", pulse: true },
  PRD_READY: { badgeVariant: "secondary", dotColor: "bg-primary", pulse: true },
  TASK_GENERATION: { badgeVariant: "secondary", dotColor: "bg-primary", pulse: true },
  PLANNING: { badgeVariant: "secondary", dotColor: "bg-primary", pulse: true },
  IN_DEVELOPMENT: { badgeVariant: "secondary", dotColor: "bg-primary", pulse: true },
  PR_LINKED: { badgeVariant: "secondary", dotColor: "bg-primary", pulse: true },
  REVIEWING: { badgeVariant: "secondary", dotColor: "bg-primary", pulse: true },
  RE_REVIEWING: { badgeVariant: "secondary", dotColor: "bg-primary", pulse: true },
  CHANGES_REQUESTED: { badgeVariant: "destructive", dotColor: "bg-warning", pulse: false, showDot: false },
  REVIEW_PASSED: { badgeVariant: "secondary", dotColor: "bg-success", pulse: true },
  PENDING_APPROVAL: { badgeVariant: "secondary", dotColor: "bg-primary", pulse: true },
  APPROVED: { badgeVariant: "secondary", dotColor: "bg-success", pulse: true },
  SHIPPED: { badgeVariant: "success", dotColor: "bg-success", pulse: false },
  REJECTED: { badgeVariant: "destructive", dotColor: "bg-destructive", pulse: false },
  OPEN: { badgeVariant: "secondary", dotColor: "bg-primary", pulse: false, showDot: false },
  MERGED: { badgeVariant: "success", dotColor: "bg-success", pulse: false },
  CLOSED: { badgeVariant: "destructive", dotColor: "bg-destructive", pulse: false },
}

const DEFAULT_META: StatusMeta = { badgeVariant: "outline", dotColor: "bg-muted-foreground", pulse: false }

export function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ")
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = STATUS_META[status] ?? DEFAULT_META

  return (
    <Badge variant={meta.badgeVariant} className={cn("gap-1.5", className)}>
      {meta.showDot !== false && (
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            meta.dotColor,
            meta.pulse && "status-dot-pulse",
          )}
        />
      )}
      {statusLabel(status)}
    </Badge>
  )
}
