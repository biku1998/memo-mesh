import { getDecryptedProviderApiKey } from "@memo-mesh/db";

const ENV_VAR_MAP: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

/**
 * Resolves an API key for the given provider.
 * Priority: encrypted DB value → env var fallback → throws.
 */
export async function getProviderApiKey(provider: string): Promise<string> {
  const dbKey = await getDecryptedProviderApiKey(provider);
  if (dbKey) return dbKey;

  const envVar = ENV_VAR_MAP[provider];
  const envKey = envVar ? process.env[envVar] : undefined;
  if (envKey) return envKey;

  throw new Error(
    `${provider} API key not configured — set ${envVar ?? `${provider.toUpperCase()}_API_KEY`} env var or store it via PUT /v1/admin/provider-keys`,
  );
}

/**
 * Resolves the OpenAI API key. Convenience wrapper for backward compat.
 */
export async function getOpenAIApiKey(): Promise<string> {
  return getProviderApiKey("openai");
}
