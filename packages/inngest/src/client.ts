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

export interface GithubPRIngestionRequested {
  name: "github/pr-ingestion.requested";
  data: {
    githubRepoId: number;
    githubPrNumber: number;
    action: "opened" | "synchronize" | "closed";
  };
}

export interface FeatureAIReviewRequested {
  name: "feature/ai-review.requested";
  data: {
    featureId: string;
    pullRequestId: string;
  };
}

/** Fired on a `synchronize` webhook for an already-linked PR. Debounced 5m per featureId. */
export interface FeaturePRResyncRequested {
  name: "feature/pr-resync.requested";
  data: {
    featureId: string;
    pullRequestId: string;
  };
}

/** Fired automatically once an AI review passes with zero blocking issues, and from the manual "Re-check" button on the Approval tab. */
export interface FeatureReleaseReadinessRequested {
  name: "feature/release-readiness.requested";
  data: {
    featureId: string;
  };
}

/** Fired right after a feature ships (10.3) to write its changelog entry (10.4). */
export interface FeatureChangelogGenerationRequested {
  name: "feature/changelog-generation.requested";
  data: {
    featureId: string;
  };
}
