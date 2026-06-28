"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { BellSimpleIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatRelativeTime } from "@/lib/utils"

export function ActivityFeed({ workspaceId }: { workspaceId: string }) {
  const trpc = useTRPC()
  const { data: activity, isLoading } = useQuery(
    trpc.notification.getWorkspaceActivity.queryOptions({ workspaceId }),
  )

  const seenIds = useRef<Set<string>>(new Set())
  const hasInitialized = useRef(false)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!activity) return

    if (!hasInitialized.current) {
      hasInitialized.current = true
      seenIds.current = new Set(activity.map((item) => item.id))
      return
    }

    const freshIds = activity.filter((item) => !seenIds.current.has(item.id)).map((item) => item.id)
    if (freshIds.length === 0) return

    for (const id of freshIds) seenIds.current.add(id)
    setNewIds((prev) => new Set([...prev, ...freshIds]))
  }, [activity])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Feed</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : activity?.length ? (
          <AnimatePresence initial={false}>
            {activity.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={cn(
                  "flex items-start gap-2.5 border-l-2 border-l-transparent pl-2",
                  newIds.has(item.id) && "activity-new",
                )}
              >
                <BellSimpleIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-xs text-foreground">{item.title ?? item.type}</span>
                  {item.message && (
                    <span className="text-xs text-muted-foreground">{item.message}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <span className="text-xs text-muted-foreground">No recent activity.</span>
        )}
      </CardContent>
    </Card>
  )
}
