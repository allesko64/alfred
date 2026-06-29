"use client"

import { useDroppable } from "@dnd-kit/core"

import { cn } from "@/lib/utils"
import { TaskCard } from "./task-card"
import type { KanbanTask, TaskStatus, WorkspaceMember } from "./types"

export const COLUMN_LABEL: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
}

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  TODO: "border-t-muted-foreground/40",
  IN_PROGRESS: "border-t-[#0075DE]",
  DONE: "border-t-[#16A34A]",
}

export function TaskColumn({
  status,
  tasks,
  members,
  onTaskClick,
}: {
  status: TaskStatus
  tasks: KanbanTask[]
  members: WorkspaceMember[]
  onTaskClick: (task: KanbanTask) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-40 w-full flex-col gap-2 rounded-lg border border-t-2 border-border bg-muted/30 p-3 transition-colors",
        COLUMN_ACCENT[status],
        isOver && "border-primary/50 bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-foreground">{COLUMN_LABEL[status]}</span>
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {tasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border py-8 text-xs text-muted-foreground">
            No tasks here yet
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              assignee={members.find((m) => m.id === task.assignedTo)}
              onClick={() => onTaskClick(task)}
            />
          ))
        )}
      </div>
    </div>
  )
}
