import { z } from "zod";

export const notificationIdInputSchema = z.object({
  notificationId: z.string().uuid(),
});

export type NotificationIdInput = z.infer<typeof notificationIdInputSchema>;
