"use client"

import { useEffect, useState } from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { CheckIcon, SpinnerIcon, XIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PriorityBadge } from "./priority-badge"
import { COLUMN_LABEL } from "./task-column"
import type { KanbanTask, TaskPriority, WorkspaceMember } from "./types"

const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
const UNASSIGNED = "unassigned"

export function TaskDetailDrawer({
  task,
  members,
  onClose,
  onSave,
  onMarkDone,
  isSaving,
}: {
  task: KanbanTask | null
  members: WorkspaceMember[]
  onClose: () => void
  onSave: (patch: { title: string; description: string | null; priority: TaskPriority; assignedTo: string | null }) => void
  onMarkDone: () => void
  isSaving: boolean
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM")
  const [assignedTo, setAssignedTo] = useState(UNASSIGNED)

  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setDescription(task.description ?? "")
    setPriority(task.priority)
    setAssignedTo(task.assignedTo ?? UNASSIGNED)
  }, [task])

  return (
    <DialogPrimitive.Root open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/10 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-sm flex-col gap-4 bg-popover p-5 text-popover-foreground shadow-xl ring-1 ring-foreground/10 duration-200 data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right">
          <div className="flex items-center justify-between">
            <DialogPrimitive.Title className="text-sm font-semibold text-foreground">
              Task details
            </DialogPrimitive.Title>
            <DialogPrimitive.Close render={<Button variant="ghost" size="icon-sm" />}>
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {task && (
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge priority={priority} />
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {COLUMN_LABEL[task.status]}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-title">Title</Label>
                <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-32"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-1 flex-col gap-1.5">
                  <Label>Assignee</Label>
                  <Select value={assignedTo} onValueChange={(value) => setAssignedTo(value ?? UNASSIGNED)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name ?? member.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            {task?.status !== "DONE" && (
              <Button variant="outline" disabled={isSaving} onClick={onMarkDone}>
                <CheckIcon className="size-4" />
                Mark done
              </Button>
            )}
            <Button
              disabled={isSaving || title.trim().length < 2}
              onClick={() =>
                onSave({
                  title: title.trim(),
                  description: description.trim() ? description.trim() : null,
                  priority,
                  assignedTo: assignedTo === UNASSIGNED ? null : assignedTo,
                })
              }
            >
              {isSaving && <SpinnerIcon className="size-4 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
