"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { BellSimpleIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Timestamp } from "@/components/workspace/timestamp"
import { cn } from "@/lib/utils"

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
            {activity.map((item) => {
              const content = (
                <>
                  <BellSimpleIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-xs text-foreground">{item.title ?? item.type}</span>
                    {item.message && (
                      <span className="text-xs text-muted-foreground">{item.message}</span>
                    )}
                    <Timestamp date={item.createdAt} className="text-[10px] text-muted-foreground" />
                  </div>
                </>
              )

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className={cn(
                    "border-l-2 border-l-transparent",
                    newIds.has(item.id) && "activity-new",
                  )}
                >
                  {item.featureId ? (
                    <Link
                      href={`/workspace/${workspaceId}/features/${item.featureId}`}
                      className="flex items-start gap-2.5 pl-2 hover:text-foreground"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-2.5 pl-2">{content}</div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <BellSimpleIcon className="size-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Nothing yet — activity will show up here as your team ships.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
