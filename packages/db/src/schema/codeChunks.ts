import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { repositories } from "./projects";
import { workspaces } from "./workspaces";

export const codeChunks = pgTable(
  "code_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    filePath: text("file_path").notNull(),
    chunkIndex: integer("chunk_index"),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    lastCommit: text("last_commit"),
    language: text("language"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("code_chunks_repository_file_idx").on(
      table.repositoryId,
      table.filePath,
    ),
    index("code_chunks_embedding_idx")
      .using("ivfflat", table.embedding.op("vector_cosine_ops"))
      .with({ lists: 100 }),
  ],
);
