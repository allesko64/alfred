"use client"

import { useState } from "react"
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"

import { TaskColumn } from "./task-column"
import { TaskDetailDrawer } from "./task-detail-drawer"
import type { KanbanTask, TaskPriority, TaskStatus, WorkspaceMember } from "./types"

const COLUMNS: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"]

export function KanbanBoard({
  tasks,
  members,
  onMove,
  onUpdate,
  onMarkDone,
  isSavingTask,
}: {
  tasks: KanbanTask[]
  members: WorkspaceMember[]
  onMove: (taskId: string, status: TaskStatus, position: number) => void
  onUpdate: (taskId: string, patch: { title: string; description: string | null; priority: TaskPriority; assignedTo: string | null }) => void
  onMarkDone: (taskId: string) => void
  isSavingTask: boolean
}) {
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null)

  // Without an activation distance, dnd-kit treats every pointerdown as a
  // potential drag and swallows the click before it reaches the card's
  // onClick — cards become un-clickable. Requiring 8px of movement before a
  // drag "activates" lets a plain click pass through untouched.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const taskId = active.id as string
    const targetStatus = over.id as TaskStatus
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === targetStatus) return

    const tasksInTargetColumn = tasks.filter((t) => t.status === targetStatus)
    const nextPosition = tasksInTargetColumn.length
      ? Math.max(...tasksInTargetColumn.map((t) => t.position ?? 0)) + 1
      : 1

    onMove(taskId, targetStatus, nextPosition)
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {COLUMNS.map((status) => (
            <TaskColumn
              key={status}
              status={status}
              tasks={tasks.filter((t) => t.status === status).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))}
              members={members}
              onTaskClick={setSelectedTask}
            />
          ))}
        </div>
      </DndContext>

      <TaskDetailDrawer
        task={selectedTask}
        members={members}
        isSaving={isSavingTask}
        onClose={() => setSelectedTask(null)}
        onSave={(patch) => {
          if (!selectedTask) return
          onUpdate(selectedTask.id, patch)
          setSelectedTask(null)
        }}
        onMarkDone={() => {
          if (!selectedTask) return
          onMarkDone(selectedTask.id)
          setSelectedTask(null)
        }}
      />
    </>
  )
}
