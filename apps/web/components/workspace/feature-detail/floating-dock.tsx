"use client"

import { usePathname } from "next/navigation"
import {
  CheckCircleIcon,
  ChatsCircleIcon,
  ClockIcon,
  FileTextIcon,
  ListChecksIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { FloatingDock } from "@/components/ui/floating-dock"

const DOCK_ITEMS = [
  { title: "Overview", icon: ChatsCircleIcon, segment: "" },
  { title: "PRD", icon: FileTextIcon, segment: "prd" },
  { title: "Tasks", icon: ListChecksIcon, segment: "tasks" },
  { title: "Review", icon: MagnifyingGlassIcon, segment: "review" },
  { title: "History", icon: ClockIcon, segment: "history" },
  { title: "Approval", icon: CheckCircleIcon, segment: "approval" },
] as const

export function FeatureFloatingDock({
  workspaceId,
  featureId,
  pulseSegment,
}: {
  workspaceId: string
  featureId: string
  pulseSegment?: string
}) {
  const pathname = usePathname()
  const basePath = `/workspace/${workspaceId}/features/${featureId}`

  const items = DOCK_ITEMS.map((item) => {
    const href = item.segment ? `${basePath}/${item.segment}` : basePath
    const isActive = item.segment ? pathname.startsWith(href) : pathname === basePath
    const isPulsing = item.segment === pulseSegment

    return {
      title: item.title,
      href,
      icon: (
        <item.icon
          className={cn(
            "h-full w-full text-neutral-500 dark:text-neutral-300",
            isActive && "text-primary",
            isPulsing && "animate-pulse",
          )}
        />
      ),
    }
  })

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <FloatingDock items={items} />
    </div>
  )
}
