import { embedMany, embed } from "ai";
import { openai } from "@ai-sdk/openai";

const embeddingModel = openai.embedding("text-embedding-3-small");

/**
 * Generate an embedding vector for a single text string.
 * Returns a float array (1536 dimensions for text-embedding-3-small).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  });
  return embedding;
}

/**
 * Generate embeddings for multiple texts in a single batch call.
 */
export async function generateEmbeddings(
  texts: string[],
): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: texts,
  });
  return embeddings;
}
