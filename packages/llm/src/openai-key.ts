import { getDecryptedProviderApiKey } from "@memo-mesh/db";

/**
 * Resolves the OpenAI API key, preferring the encrypted DB value and
 * falling back to the OPENAI_API_KEY env var (useful for local dev).
 */
export async function getOpenAIApiKey(): Promise<string> {
  const dbKey = await getDecryptedProviderApiKey("openai");
  const key = dbKey ?? process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OpenAI API key not configured — set OPENAI_API_KEY env var or store it via PUT /v1/admin/provider-keys",
    );
  }
  return key;
}
