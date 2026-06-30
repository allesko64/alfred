import { cn } from "@/lib/utils"
import { Badge, type badgeVariants } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"]

type StatusMeta = {
  badgeVariant: BadgeVariant
}

// Feature statuses and PR statuses never collide, so they share one map.
const STATUS_META: Record<string, StatusMeta> = {
  DRAFT: { badgeVariant: "outline" },
  CLARIFYING: { badgeVariant: "secondary" },
  PRD_GENERATION: { badgeVariant: "secondary" },
  PRD_READY: { badgeVariant: "secondary" },
  TASK_GENERATION: { badgeVariant: "secondary" },
  PLANNING: { badgeVariant: "secondary" },
  IN_DEVELOPMENT: { badgeVariant: "secondary" },
  PR_LINKED: { badgeVariant: "secondary" },
  REVIEWING: { badgeVariant: "secondary" },
  RE_REVIEWING: { badgeVariant: "secondary" },
  CHANGES_REQUESTED: { badgeVariant: "destructive" },
  REVIEW_PASSED: { badgeVariant: "secondary" },
  PENDING_APPROVAL: { badgeVariant: "secondary" },
  APPROVED: { badgeVariant: "secondary" },
  SHIPPED: { badgeVariant: "success" },
  REJECTED: { badgeVariant: "destructive" },
  OPEN: { badgeVariant: "secondary" },
  MERGED: { badgeVariant: "success" },
  CLOSED: { badgeVariant: "destructive" },
}

const DEFAULT_META: StatusMeta = { badgeVariant: "outline" }

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
    <Badge variant={meta.badgeVariant} className={cn(className)}>
      {statusLabel(status)}
    </Badge>
  )
}
