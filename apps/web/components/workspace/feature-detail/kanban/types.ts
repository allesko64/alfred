export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE"
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export interface KanbanTask {
  id: string
  featureId: string
  workspaceId: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assignedTo: string | null
  position: number | null
}

export interface WorkspaceMember {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}
