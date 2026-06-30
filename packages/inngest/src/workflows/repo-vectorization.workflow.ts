import {
  chunkContent,
  embedTexts,
  filterVectorizableFiles,
  getFileContent,
  getRepositoryTree,
} from "@alfred/ai";
import { codeChunks, db, repositories } from "@alfred/db";
import { eq } from "drizzle-orm";
import type { InngestFunction } from "inngest";
import { inngest } from "../client";
import { reportRepositoryWorkflowProgress } from "../workflow-runs";

/** Files are fetched and embedded in small batches to bound memory and stay within OpenAI rate limits. */
const BATCH_SIZE = 10;

function reportVectorizationProgress(
  repositoryId: string,
  patch: {
    status: "running" | "completed" | "failed";
    progressMessage?: string;
    progressPercent?: number;
    errorMessage?: string;
    inngestRunId?: string;
  },
): Promise<void> {
  return reportRepositoryWorkflowProgress(
    repositoryId,
    "repo_vectorization",
    patch,
  );
}

const _repoVectorizationWorkflow = inngest.createFunction(
  { id: "repo-vectorization", triggers: { event: "repo/vectorization.requested" } },
  async ({ event, step, runId }) => {
    const { repositoryId, installationId } = event.data;

    try {
      const repository = await step.run("find-repository", async () => {
        const [repo] = await db.select().from(repositories).where(eq(repositories.id, repositoryId)).limit(1);
        return repo ?? null;
      });

      if (!repository) {
        return { status: "skipped", reason: "repository-not-found" };
      }

      await reportVectorizationProgress(repositoryId, {
        inngestRunId: runId,
        status: "running",
        progressMessage: "Starting repository vectorization...",
        progressPercent: 0,
      });

      const [owner, name] =
        repository.owner && repository.name
          ? [repository.owner, repository.name]
          : repository.fullName.split("/");
      const branch = repository.defaultBranch ?? "main";

      if (!owner || !name) {
        return { status: "skipped", reason: "missing-owner-or-name" };
      }

      const filesToIndex = await step.run("fetch-and-filter-tree", async () => {
        const tree = await getRepositoryTree(installationId, owner, name, branch);
        // Guardrail: only hand-written source code gets embedded — node_modules,
        // build output, lockfiles, binaries, and oversized files are excluded.
        return filterVectorizableFiles(tree);
      });

      if (filesToIndex.length === 0) {
        await step.run("mark-indexed-empty", async () => {
          await db
            .update(repositories)
            .set({ isIndexed: true, indexedAt: new Date() })
            .where(eq(repositories.id, repositoryId));
        });
        await reportVectorizationProgress(repositoryId, {
          status: "completed",
          progressMessage: "No vectorizable files found",
          progressPercent: 100,
        });
        return { status: "indexed", filesIndexed: 0 };
      }

      await step.run("clear-previous-chunks", async () => {
        await db.delete(codeChunks).where(eq(codeChunks.repositoryId, repositoryId));
      });

      let filesIndexed = 0;
      const totalFiles = filesToIndex.length;

      for (let i = 0; i < filesToIndex.length; i += BATCH_SIZE) {
        const batch = filesToIndex.slice(i, i + BATCH_SIZE);

        await step.run(`index-batch-${i}`, async () => {
          for (const file of batch) {
            const content = await getFileContent(installationId, owner, name, file.path, branch);
            if (!content) continue;

            const chunks = chunkContent(content);
            if (chunks.length === 0) continue;

            const embeddings = await embedTexts(chunks);

            await db.insert(codeChunks).values(
              chunks.map((chunk, chunkIndex) => ({
                repositoryId,
                workspaceId: repository.workspaceId,
                filePath: file.path,
                chunkIndex,
                content: chunk,
                embedding: embeddings[chunkIndex],
                language: file.language,
              })),
            );

            filesIndexed += 1;
          }
        });

        const progressPercent = Math.min(
          99,
          Math.round((Math.min(i + BATCH_SIZE, totalFiles) / totalFiles) * 100),
        );
        await reportVectorizationProgress(repositoryId, {
          status: "running",
          progressMessage: `Vectorized ${filesIndexed} of ${totalFiles} files`,
          progressPercent,
        });
      }

      await step.run("mark-indexed", async () => {
        await db
          .update(repositories)
          .set({ isIndexed: true, indexedAt: new Date() })
          .where(eq(repositories.id, repositoryId));
      });

      await reportVectorizationProgress(repositoryId, {
        status: "completed",
        progressMessage: `Vectorized ${filesIndexed} of ${totalFiles} files`,
        progressPercent: 100,
      });

      return { status: "indexed", filesIndexed };
    } catch (error) {
      await reportVectorizationProgress(repositoryId, {
        status: "failed",
        progressMessage: "Repository vectorization failed unexpectedly",
        errorMessage: error instanceof Error ? error.message : String(error),
        progressPercent: 100,
      });
      throw error; // Re-throw so Inngest records the failure and respects retry policy.
    }
  },
);

export const repoVectorizationWorkflow: InngestFunction.Any = _repoVectorizationWorkflow;
