"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { BellIcon, MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"

export function TopBar({ title, workspaceId }: { title: string; workspaceId: string }) {
  const trpc = useTRPC()
  const { data: unread } = useQuery(trpc.notification.getUnread.queryOptions())
  const unreadCount = unread?.length ?? 0

  return (
    <div className="flex h-16 items-center gap-4 border-b border-border px-6">
      <h1 className="w-48 shrink-0 text-xl font-semibold text-foreground">{title}</h1>

      <div className="relative mx-auto w-full max-w-md">
        <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search features, tasks, PRs..." className="pl-8" disabled />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          className="relative rounded-lg text-muted-foreground hover:text-foreground"
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
        </button>
        <ThemeToggle size="icon-sm" />
        <Button
          render={<Link href={`/workspace/${workspaceId}/features/new`} />}
          nativeButton={false}
          className="btn-shimmer"
        >
          <PlusIcon />
          New Feature
        </Button>
      </div>
    </div>
  )
}
