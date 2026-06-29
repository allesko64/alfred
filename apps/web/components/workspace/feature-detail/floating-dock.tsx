"use client"

import { usePathname } from "next/navigation"
import {
  ChatsCircleIcon,
  FileTextIcon,
  ListChecksIcon,
  MagnifyingGlassIcon,
  SealCheckIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { FloatingDock } from "@/components/ui/floating-dock"

const DOCK_ITEMS = [
  { title: "Conversation", icon: ChatsCircleIcon, segment: "" },
  { title: "PRD", icon: FileTextIcon, segment: "prd" },
  { title: "Tasks", icon: ListChecksIcon, segment: "tasks" },
  { title: "Review", icon: MagnifyingGlassIcon, segment: "review" },
  { title: "Approval", icon: SealCheckIcon, segment: "approval" },
] as const

export function FeatureFloatingDock({
  workspaceId,
  featureId,
  pulseSegment,
  mutedSegments,
}: {
  workspaceId: string
  featureId: string
  pulseSegment?: string
  mutedSegments?: string[]
}) {
  const pathname = usePathname()
  const basePath = `/workspace/${workspaceId}/features/${featureId}`

  const items = DOCK_ITEMS.map((item) => {
    const href = item.segment ? `${basePath}/${item.segment}` : basePath
    const isActive = item.segment ? pathname.startsWith(href) : pathname === basePath
    const isPulsing = item.segment === pulseSegment
    const isMuted = !!mutedSegments?.includes(item.segment)

    return {
      title: item.title,
      href,
      isActive,
      icon: (
        <item.icon
          className={cn(
            "h-full w-full text-neutral-500 dark:text-neutral-300",
            isActive && "text-primary",
            isPulsing && "animate-pulse",
            isMuted && "opacity-40",
          )}
        />
      ),
    }
  })

  return (
    // Offset by the sidebar's width (w-60) so the dock centers on the content
    // area to the right of it, not the full viewport.
    <div className="fixed bottom-6 left-60 right-0 z-50 flex justify-center">
      <FloatingDock items={items} />
    </div>
  )
}
