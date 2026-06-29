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
  workspaceId: z.string().uuid(),
  featureId: z.string().uuid(),
  pullRequestId: z.string().uuid(),
});

export type LinkPullRequestInput = z.infer<typeof linkPullRequestSchema>;

export const unlinkPullRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  pullRequestId: z.string().uuid(),
});

export type UnlinkPullRequestInput = z.infer<typeof unlinkPullRequestSchema>;

export const connectRepositorySchema = z.object({
  workspaceId: z.string().uuid(),
  installationId: z.number().int().positive(),
  githubRepoId: z.number().int().positive(),
});

export type ConnectRepositoryInput = z.infer<typeof connectRepositorySchema>;

export const repositoryActionSchema = z.object({
  workspaceId: z.string().uuid(),
  repositoryId: z.string().uuid(),
});

export type RepositoryActionInput = z.infer<typeof repositoryActionSchema>;

export const listUnlinkedPullRequestsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export type ListUnlinkedPullRequestsInput = z.infer<typeof listUnlinkedPullRequestsSchema>;

export const requestReviewNowSchema = z.object({
  workspaceId: z.string().uuid(),
  featureId: z.string().uuid(),
});

export type RequestReviewNowInput = z.infer<typeof requestReviewNowSchema>;
