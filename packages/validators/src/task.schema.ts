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
