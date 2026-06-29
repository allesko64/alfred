import { cn } from "@/lib/utils"
import type { TaskPriority } from "./types"

// Colors are intentionally specific hex values (not theme tokens) so urgency
// reads instantly and consistently regardless of theme: red stop-and-fix-first,
// grey do-it-eventually.
const PRIORITY_STYLES: Record<TaskPriority, string> = {
  CRITICAL: "bg-[#DC2626] text-white",
  HIGH: "bg-[#EA580C] text-white",
  MEDIUM: "bg-[#0075DE] text-white",
  LOW: "border border-muted-foreground/30 text-muted-foreground",
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        PRIORITY_STYLES[priority],
      )}
    >
      {priority}
    </span>
  )
}
