import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@memo-mesh/db";

/**
 * Validates the X-API-Key header against Project.apiKey in the database.
 * Also confirms the key's projectId matches the `:projectId` URL param.
 *
 * Use this as a preHandler hook on all agent-facing routes.
 */
export async function requireApiKey(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = request.headers["x-api-key"];
  if (!apiKey || typeof apiKey !== "string") {
    return reply.status(401).send({ error: "Missing X-API-Key header" });
  }

  const project = await prisma.project.findUnique({
    where: { apiKey },
    select: { id: true },
  });

  if (!project) {
    return reply.status(401).send({ error: "Invalid API key" });
  }

  const params = request.params as Record<string, string>;
  if (params.projectId && params.projectId !== project.id) {
    return reply.status(403).send({ error: "API key does not belong to this project" });
  }
}
