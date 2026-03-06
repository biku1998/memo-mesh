import { FastifyPluginAsync } from "fastify";
import { prisma, encrypt, decrypt } from "@memo-mesh/db";
import { UpsertProviderKeyBody, DeleteProviderKeyParams } from "@memo-mesh/shared";

function maskKey(key: string): string {
  if (key.length <= 8) return "*".repeat(key.length);
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export const providerKeyRoutes: FastifyPluginAsync = async (fastify) => {
  // PUT /v1/admin/provider-keys — encrypt and upsert a provider API key
  fastify.put("/v1/admin/provider-keys", async (request, reply) => {
    const userId = request.session.userId;
    if (!userId) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    const encryptionSecret = process.env.KEY_ENCRYPTION_SECRET;
    if (!encryptionSecret) {
      return reply.status(503).send({ error: "KEY_ENCRYPTION_SECRET is not configured on this server" });
    }

    const parsed = UpsertProviderKeyBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const { provider, key } = parsed.data;

    const encryptedKey = encrypt(key, encryptionSecret);

    const row = await prisma.providerKey.upsert({
      where: { provider },
      create: { provider, encryptedKey },
      update: { encryptedKey },
    });

    return reply.send({
      provider: row.provider,
      updatedAt: row.updatedAt.toISOString(),
    });
  });

  // DELETE /v1/admin/provider-keys/:provider — remove a provider API key
  fastify.delete("/v1/admin/provider-keys/:provider", async (request, reply) => {
    const userId = request.session.userId;
    if (!userId) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    const parsed = DeleteProviderKeyParams.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid provider" });
    }
    const { provider } = parsed.data;

    const { count } = await prisma.providerKey.deleteMany({ where: { provider } });
    if (count === 0) {
      return reply.status(404).send({ error: "Provider key not found" });
    }

    return reply.send({ ok: true });
  });

  // GET /v1/admin/provider-keys — list stored provider keys (masked)
  fastify.get("/v1/admin/provider-keys", async (request, reply) => {
    const userId = request.session.userId;
    if (!userId) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    const encryptionSecret = process.env.KEY_ENCRYPTION_SECRET;
    if (!encryptionSecret) {
      return reply.status(503).send({ error: "KEY_ENCRYPTION_SECRET is not configured on this server" });
    }

    const rows = await prisma.providerKey.findMany({ orderBy: { provider: "asc" } });

    return reply.send(
      rows.map((row) => {
        let maskedKey: string;
        try {
          maskedKey = maskKey(decrypt(row.encryptedKey, encryptionSecret));
        } catch {
          maskedKey = "****";
        }
        return {
          provider: row.provider,
          maskedKey,
          updatedAt: row.updatedAt.toISOString(),
        };
      }),
    );
  });
};
