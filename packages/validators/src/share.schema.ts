import { z } from "zod";

export const getPublicShareSchema = z.object({
  token: z.string().min(1),
});

export type GetPublicShareInput = z.infer<typeof getPublicShareSchema>;
