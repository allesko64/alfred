import { z } from "zod";

export const updateDigestPreferencesSchema = z.object({
  digestEnabled: z.boolean(),
});

export type UpdateDigestPreferencesInput = z.infer<
  typeof updateDigestPreferencesSchema
>;
