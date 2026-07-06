"use client"

import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BellIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { getNotificationPath } from "@/lib/notification-link"
import { cn, formatRelativeTime } from "@/lib/utils"
import { Button as StatefulButton } from "@/components/ui/stateful-button"
import { Badge } from "@/components/ui/badge"
import { GooDropdown } from "@/components/ui/goo-dropdown"
import { ThemeToggle } from "@/components/theme-toggle"
import { SearchPalette } from "@/components/workspace/search-palette"

export function TopBar({ title, workspaceId }: { title: string; workspaceId: string }) {
  const trpc = useTRPC()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: unread } = useQuery(
    trpc.notification.getUnread.queryOptions(undefined, { refetchInterval: 30000 }),
  )
  const unreadCount = unread?.length ?? 0

  const markRead = useMutation(
    trpc.notification.markRead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.notification.getUnread.queryKey() })
      },
    }),
  )

  const markAllRead = useMutation(
    trpc.notification.markAllRead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.notification.getUnread.queryKey() })
      },
    }),
  )

  function onNotificationClick(notificationId: string, type: string, featureId: string | null) {
    markRead.mutate({ notificationId })
    const path = getNotificationPath(workspaceId, { type, featureId })
    if (path) {
      router.push(path)
    }
  }

  return (
    <div className="grid h-16 grid-cols-[1fr_minmax(0,28rem)_1fr] items-center gap-4 border-b border-border px-6">
      <h1 className="truncate text-xl font-semibold text-foreground">{title}</h1>

      <SearchPalette workspaceId={workspaceId} />

      <div className="flex items-center justify-end gap-3">
        <GooDropdown
          panelWidth={320}
          align="end"
          trigger={
            <span className="relative flex size-9 items-center justify-center text-muted-foreground hover:text-foreground">
              <BellIcon className="size-5" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute right-0.5 top-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </span>
          }
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm text-muted-foreground">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => markAllRead.mutate()}
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="-mx-1 h-px bg-border" />
          {unread?.length ? (
            unread.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 whitespace-normal rounded-md px-2 py-2 text-left hover:bg-accent",
                  !getNotificationPath(workspaceId, notification) && "cursor-default",
                )}
                onClick={() => onNotificationClick(notification.id, notification.type, notification.featureId)}
              >
                <span className="text-sm font-medium text-foreground">
                  {notification.title ?? notification.type}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(notification.createdAt)}
                </span>
              </button>
            ))
          ) : (
            <div className="px-2 py-2 text-sm text-muted-foreground">No unread notifications</div>
          )}
        </GooDropdown>
        <ThemeToggle size="icon-sm" />
        <StatefulButton
          className="min-w-0 whitespace-nowrap px-4 py-1.5 text-sm"
          onClick={() => router.push(`/workspace/${workspaceId}/features/new`)}
        >
          New Feature
          <kbd className="ml-2 rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1 py-0.5 text-[10px] font-normal">
            N
          </kbd>
        </StatefulButton>
      </div>
    </div>
  )
}
