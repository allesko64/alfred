"use client"

import { useDraggable } from "@dnd-kit/core"
import { DotsSixVerticalIcon } from "@phosphor-icons/react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { PriorityBadge } from "./priority-badge"
import type { KanbanTask, WorkspaceMember } from "./types"

function initials(member: WorkspaceMember) {
  const source = member.name ?? member.email
  return source.slice(0, 2).toUpperCase()
}

export function TaskCard({
  task,
  assignee,
  onClick,
}: {
  task: KanbanTask
  assignee?: WorkspaceMember
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })

  return (
    <button
      type="button"
      ref={setNodeRef}
      onClick={onClick}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        "group relative flex w-full items-start gap-2 rounded-lg border border-l-2 border-border border-l-transparent bg-card px-3 py-2.5 text-left transition-colors hover:border-l-[#0075DE] hover:bg-muted/60 hover:cursor-grab",
        isDragging && "z-10 cursor-grabbing opacity-50 shadow-lg",
      )}
      {...listeners}
      {...attributes}
    >
      <DotsSixVerticalIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-50" />
      <div className="flex flex-1 flex-col gap-2">
        <span className="text-sm font-medium text-foreground">{task.title}</span>
        {task.description && (
          <span className="line-clamp-2 text-sm font-normal text-muted-foreground">{task.description}</span>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <PriorityBadge priority={task.priority} />
          {assignee && (
            <Avatar size="sm">
              <AvatarFallback className="text-[10px]">{initials(assignee)}</AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </button>
  )
}
