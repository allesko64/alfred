import { z } from "zod";

export const workspaceSlugInputSchema = z.object({
  workspaceSlug: z.string(),
});

export type WorkspaceSlugInput = z.infer<typeof workspaceSlugInputSchema>;
