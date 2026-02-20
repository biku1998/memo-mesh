import { embedMany, embed } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getDecryptedProviderApiKey } from "@memo-mesh/db";

/**
 * Resolves the OpenAI API key, preferring the encrypted DB value and
 * falling back to the OPENAI_API_KEY env var (useful for local dev).
 */
async function getOpenAIApiKey(): Promise<string> {
  const dbKey = await getDecryptedProviderApiKey("openai");
  const key = dbKey ?? process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OpenAI API key not configured — set OPENAI_API_KEY env var or store it via PUT /v1/admin/provider-keys",
    );
  }
  return key;
}

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
