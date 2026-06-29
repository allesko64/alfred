import { z } from "zod";

export const updateDigestPreferencesSchema = z.object({
  digestEnabled: z.boolean(),
  digestHourLocal: z.number().int().min(0).max(23),
  digestTimezone: z.string().min(1),
});

export type UpdateDigestPreferencesInput = z.infer<
  typeof updateDigestPreferencesSchema
>;
