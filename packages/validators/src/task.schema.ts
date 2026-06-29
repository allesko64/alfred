import { z } from "zod";

export const taskStatusValues = ["TODO", "IN_PROGRESS", "DONE"] as const;
export const taskPriorityValues = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const createTaskSchema = z.object({
  featureId: z.string().uuid(),
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  priority: z.enum(taskPriorityValues).default("MEDIUM"),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskStatusSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(taskStatusValues),
});

export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;

export const moveTaskSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(taskStatusValues),
  position: z.number().int().min(0),
});

export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

export const updateTaskSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().min(2, "Title must be at least 2 characters").optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(taskPriorityValues).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const approveTaskPlanSchema = z.object({
  featureId: z.string().uuid(),
});

export type ApproveTaskPlanInput = z.infer<typeof approveTaskPlanSchema>;
