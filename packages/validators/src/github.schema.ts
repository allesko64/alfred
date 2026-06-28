import { z } from "zod";

export const connectGithubSchema = z.object({
  workspaceId: z.string().uuid(),
  installationId: z.number().int().positive(),
});

export type ConnectGithubInput = z.infer<typeof connectGithubSchema>;

export const listInstallationReposSchema = z.object({
  installationId: z.number().int().positive(),
});

export type ListInstallationReposInput = z.infer<typeof listInstallationReposSchema>;

export const completeWorkspaceOnboardingSchema = z.object({
  name: z.string().min(2, "Workspace name must be at least 2 characters"),
  buildingType: z.string().min(1).optional(),
  installationId: z.number().int().positive(),
  // Optional: when omitted, the first repo accessible to the installation is used.
  githubRepoId: z.number().int().positive().optional(),
});

export type CompleteWorkspaceOnboardingInput = z.infer<
  typeof completeWorkspaceOnboardingSchema
>;

export const getInstallationUrlSchema = z.object({
  state: z.string().min(1),
});

export type GetInstallationUrlInput = z.infer<typeof getInstallationUrlSchema>;

export const lookupGithubUserSchema = z.object({
  username: z.string().min(1),
});

export type LookupGithubUserInput = z.infer<typeof lookupGithubUserSchema>;

export const linkPullRequestSchema = z.object({
  featureId: z.string().uuid(),
  pullRequestId: z.string().uuid(),
});

export type LinkPullRequestInput = z.infer<typeof linkPullRequestSchema>;
