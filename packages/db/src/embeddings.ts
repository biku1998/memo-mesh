import { prisma } from "./index.js";

/**
 * Store an embedding vector for a memory using raw SQL (pgvector).
 * Prisma's `Unsupported("vector")` type can't be written via the ORM,
 * so we use $executeRawUnsafe with parameterized queries.
 */
export async function storeMemoryEmbedding(
  memoryId: string,
  embedding: number[],
): Promise<void> {
  const vectorStr = `[${embedding.join(",")}]`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "MemoryEmbedding" ("memoryId", "embedding")
     VALUES ($1, $2::vector)
     ON CONFLICT ("memoryId") DO UPDATE SET "embedding" = $2::vector`,
    memoryId,
    vectorStr,
  );
}

export interface VectorSearchResult {
  memoryId: string;
  text: string;
  type: string;
  similarity: number;
  createdAt: Date;
}

/**
 * Search memories by vector similarity using pgvector cosine distance.
 * Filters by projectId and optionally by memory type.
 * Returns top-k results ordered by cosine similarity (highest first).
 */
export async function searchMemoriesByVector(opts: {
  projectId: string;
  queryEmbedding: number[];
  k: number;
  includeRaw: boolean;
}): Promise<VectorSearchResult[]> {
  const { projectId, queryEmbedding, k, includeRaw } = opts;
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  const typeFilter = includeRaw ? "" : `AND m."type" != 'raw'`;

  const results = await prisma.$queryRawUnsafe<VectorSearchResult[]>(
    `SELECT
       m."id" AS "memoryId",
       m."text",
       m."type",
       1 - (me."embedding" <=> $1::vector) AS "similarity",
       m."createdAt"
     FROM "MemoryEmbedding" me
     JOIN "Memory" m ON m."id" = me."memoryId"
     WHERE m."projectId" = $2
       AND m."status" = 'active'
       ${typeFilter}
     ORDER BY me."embedding" <=> $1::vector
     LIMIT $3`,
    vectorStr,
    projectId,
    k,
  );

  return results;
}
