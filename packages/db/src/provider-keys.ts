import { prisma } from "./index.js";
import { decrypt } from "./encryption.js";

/**
 * Fetches the stored encrypted key for `provider` and decrypts it.
 * Returns null if:
 *   - KEY_ENCRYPTION_SECRET is not set
 *   - No key has been stored for the provider
 */
export async function getDecryptedProviderApiKey(provider: string): Promise<string | null> {
  const encryptionSecret = process.env.KEY_ENCRYPTION_SECRET;
  if (!encryptionSecret) return null;

  const row = await prisma.providerKey.findUnique({ where: { provider } });
  if (!row) return null;

  try {
    return decrypt(row.encryptedKey, encryptionSecret);
  } catch {
    return null;
  }
}
