import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "alfred" });

export interface RepoVectorizationRequested {
  name: "repo/vectorization.requested";
  data: {
    repositoryId: string;
    installationId: number;
  };
}
