import { FastifyPluginAsync } from "fastify";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@memo-mesh/db";
import { CreateProjectBody, UpdateProjectBody } from "@memo-mesh/shared";

const GetProjectApiKeyParams = z.object({ projectId: z.string().min(1, "projectId is required") });

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/projects — create a new project (requires session)
  // Returns apiKey once at creation time.
  fastify.post("/v1/projects", async (request, reply) => {
    const userId = request.session.userId;
    if (!userId) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    const parsed = CreateProjectBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const { name, provider } = parsed.data;

    const apiKey = `mm_${crypto.randomBytes(24).toString("hex")}`;

    const project = await prisma.project.create({
      data: { userId, name, provider, apiKey },
    });

    return reply.status(201).send({
      id: project.id,
      name: project.name,
      provider: project.provider,
      apiKey: project.apiKey,
      createdAt: project.createdAt.toISOString(),
    });
  });

  // GET /v1/projects — list projects (no apiKey — use GET /projects/:id/api-key to fetch it)
  fastify.get("/v1/projects", async (request, reply) => {
    const userId = request.session.userId;
    if (!userId) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, provider: true, createdAt: true },
    });

    return reply.send(
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        provider: p.provider,
        createdAt: p.createdAt.toISOString(),
      })),
    );
  });

  // PATCH /v1/projects/:projectId — update project provider (requires session + ownership)
  fastify.patch("/v1/projects/:projectId", async (request, reply) => {
    const userId = request.session.userId;
    if (!userId) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    const parsedParams = GetProjectApiKeyParams.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({ error: parsedParams.error.issues[0]?.message ?? "Invalid params" });
    }
    const { projectId } = parsedParams.data;

    const parsed = UpdateProjectBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const { provider } = parsed.data;

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { provider },
    });

    return reply.send({
      id: updated.id,
      name: updated.name,
      provider: updated.provider,
      createdAt: updated.createdAt.toISOString(),
    });
  });

  // DELETE /v1/projects/:projectId — delete project and all related data (requires session + ownership)
  fastify.delete("/v1/projects/:projectId", async (request, reply) => {
    const userId = request.session.userId;
    if (!userId) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    const parsedParams = GetProjectApiKeyParams.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({ error: parsedParams.error.issues[0]?.message ?? "Invalid params" });
    }
    const { projectId } = parsedParams.data;

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    // Cascading delete in correct FK order within a transaction
    await prisma.$transaction(async (tx) => {
      // 1. MemoryEmbedding (depends on Memory)
      await tx.memoryEmbedding.deleteMany({
        where: { memory: { projectId } },
      });

      // 2. EntityMention (depends on Memory + Entity)
      await tx.entityMention.deleteMany({
        where: {
          OR: [
            { memory: { projectId } },
            { entity: { projectId } },
          ],
        },
      });

      // 3. Relation (depends on Entity + Memory)
      await tx.relation.deleteMany({ where: { projectId } });

      // 4. Memory (depends on Message via sourceMessageId, nullable)
      await tx.memory.deleteMany({ where: { projectId } });

      // 5. Entity
      await tx.entity.deleteMany({ where: { projectId } });

      // 6. Message
      await tx.message.deleteMany({ where: { projectId } });

      // 7. Project
      await tx.project.delete({ where: { id: projectId } });
    });

    return reply.status(204).send();
  });

  // GET /v1/projects/:projectId/api-key — retrieve API key for a project (requires session + ownership)
  fastify.get("/v1/projects/:projectId/api-key", async (request, reply) => {
    const userId = request.session.userId;
    if (!userId) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    const parsedParams = GetProjectApiKeyParams.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({ error: parsedParams.error.issues[0]?.message ?? "Invalid params" });
    }
    const { projectId } = parsedParams.data;

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { apiKey: true },
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    return reply.send({ apiKey: project.apiKey });
  });
};
