import { embedMany, embed } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getOpenAIApiKey } from "./provider-key.js";

/**
 * Generate an embedding vector for a single text string.
 * Returns a float array (1536 dimensions for text-embedding-3-small).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = await getOpenAIApiKey();
  const model = createOpenAI({ apiKey }).embedding("text-embedding-3-small");
  const { embedding } = await embed({ model, value: text });
  return embedding;
}

/**
 * Generate embeddings for multiple texts in a single batch call.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = await getOpenAIApiKey();
  const model = createOpenAI({ apiKey }).embedding("text-embedding-3-small");
  const { embeddings } = await embedMany({ model, values: texts });
  return embeddings;
}
