import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "alfred" });

export interface RepoVectorizationRequested {
  name: "repo/vectorization.requested";
  data: {
    repositoryId: string;
    installationId: number;
  };
}

export interface FeatureClarificationRequested {
  name: "feature/clarification.requested";
  data: {
    featureId: string;
  };
}

export interface FeaturePRDGenerationRequested {
  name: "feature/prd-generation.requested";
  data: {
    featureId: string;
  };
}

export interface FeatureTaskGenerationRequested {
  name: "feature/task-generation.requested";
  data: {
    featureId: string;
  };
}
