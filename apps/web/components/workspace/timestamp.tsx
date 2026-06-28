"use client"

import { formatRelativeTime } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function Timestamp({ date, className }: { date: Date | string; className?: string }) {
  const target = typeof date === "string" ? new Date(date) : date

  return (
    <Tooltip>
      <TooltipTrigger render={<span className={className} />}>
        {formatRelativeTime(target)}
      </TooltipTrigger>
      <TooltipContent>
        {target.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
      </TooltipContent>
    </Tooltip>
  )
}
