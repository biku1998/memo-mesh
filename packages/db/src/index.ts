import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — PrismaPg/PrismaClient cannot be initialized. " +
        "Set DATABASE_URL in your environment before importing @memo-mesh/db.",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
export type * from "./generated/prisma/client.js";
export {
  storeMemoryEmbedding,
  searchMemoriesByVector,
  findSimilarActiveFacts,
  findSimilarMemoriesByMemoryId,
  supersedeMemory,
} from "./embeddings.js";
export type { VectorSearchResult, SimilarMemoryResult } from "./embeddings.js";
export {
  getMemoriesWithEntityMentions,
  getMemoryWithProvenance,
} from "./memories.js";
export type { MemoryWithMentions, MemoryEntityMention } from "./memories.js";
export { encrypt, decrypt } from "./encryption.js";
export { getDecryptedProviderApiKey } from "./provider-keys.js";
