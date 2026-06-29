"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BellIcon, PlusIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { cn, formatRelativeTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

  function onNotificationClick(notificationId: string, featureId: string | null) {
    markRead.mutate({ notificationId })
    if (featureId) {
      router.push(`/workspace/${workspaceId}/features/${featureId}`)
    }
  }

  return (
    <div className="flex h-16 items-center gap-4 border-b border-border px-6">
      <h1 className="w-48 shrink-0 text-xl font-semibold text-foreground">{title}</h1>

      <SearchPalette workspaceId={workspaceId} />

      <div className="flex shrink-0 items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="relative rounded-lg text-muted-foreground hover:text-foreground"
              />
            }
          >
            <BellIcon className="size-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-1.5 -top-1.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2 py-1.5">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
              </DropdownMenuGroup>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => markAllRead.mutate()}
                >
                  Mark all as read
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
            {unread?.length ? (
              unread.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn("flex-col items-start gap-0.5 whitespace-normal", !notification.featureId && "cursor-default")}
                  onClick={() => onNotificationClick(notification.id, notification.featureId)}
                >
                  <span className="text-xs font-medium text-foreground">
                    {notification.title ?? notification.type}
                  </span>
                  {notification.message && (
                    <span className="text-xs text-muted-foreground">{notification.message}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(notification.createdAt)}
                  </span>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>No unread notifications</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeToggle size="icon-sm" />
        <Button render={<Link href={`/workspace/${workspaceId}/features/new`} />} nativeButton={false}>
          <PlusIcon />
          New Feature
        </Button>
      </div>
    </div>
  )
}
