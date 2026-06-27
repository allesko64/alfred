import { z } from "zod";

export const membershipRoleValues = [
  "owner",
  "admin",
  "developer",
  "reviewer",
  "viewer",
] as const;

export const inviteMemberSchema = z
  .object({
    workspaceId: z.string().uuid(),
    githubUsername: z.string().min(1).optional(),
    email: z.string().email().optional(),
    role: z.enum(membershipRoleValues),
  })
  .refine((data) => data.githubUsername || data.email, {
    message: "Provide a GitHub username or an email address",
    path: ["email"],
  });

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
