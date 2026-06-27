import { z } from "zod";

export const connectGithubSchema = z.object({
  workspaceId: z.string().uuid(),
  installationId: z.number().int().positive(),
});

export type ConnectGithubInput = z.infer<typeof connectGithubSchema>;

export const linkPullRequestSchema = z.object({
  featureId: z.string().uuid(),
  pullRequestId: z.string().uuid(),
});

export type LinkPullRequestInput = z.infer<typeof linkPullRequestSchema>;
