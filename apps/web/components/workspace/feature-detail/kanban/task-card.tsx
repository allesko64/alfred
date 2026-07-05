"use client"

import { useState } from "react"
import { useDraggable } from "@dnd-kit/core"
import { CheckIcon, CopyIcon, DotsSixVerticalIcon } from "@phosphor-icons/react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { PriorityBadge } from "./priority-badge"
import type { KanbanTask, WorkspaceMember } from "./types"

function initials(member: WorkspaceMember) {
  const source = member.name ?? member.email
  return source.slice(0, 2).toUpperCase()
}

function CopyPromptPill({ prompt }: { prompt: string | null }) {
  const [copied, setCopied] = useState(false)

  if (!prompt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground/60">
        Prompt generating…
      </span>
    )
  }

  return (
    // Not a <button>: the card root is already a button (nested interactive
    // elements are invalid HTML and break dnd-kit's drag listeners).
    <span
      role="button"
      tabIndex={0}
      aria-label="Copy AI implementation prompt"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          e.stopPropagation()
          void navigator.clipboard.writeText(prompt)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }
      }}
      onClick={(e) => {
        e.stopPropagation()
        void navigator.clipboard.writeText(prompt)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-[#0075DE]/40 hover:text-foreground",
        copied && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
      )}
    >
      {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
      {copied ? "Copied" : "Copy prompt"}
    </span>
  )
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
          <div className="flex items-center gap-1.5">
            <PriorityBadge priority={task.priority} />
            <CopyPromptPill prompt={task.implementationPrompt} />
          </div>
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
