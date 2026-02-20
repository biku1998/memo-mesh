import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  prisma,
  findSimilarMemoriesByMemoryId,
  getMemoryWithProvenance,
} from "@memo-mesh/db";
import { MemoryParams } from "@memo-mesh/shared";

const MemoriesParams = z.object({
  projectId: z.string().min(1, "projectId is required"),
});

const MemoriesQuery = z.object({
  type: z.string().default("fact"),
  status: z.string().default("active"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const memoryRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/projects/:projectId/memories?type=fact&status=active&limit=50
   * Returns recent memories for a project, newest first.
   */
  fastify.get("/memories", async (request, reply) => {
    const parsedParams = MemoriesParams.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsedParams.error.flatten().fieldErrors,
      });
    }
    const { projectId } = parsedParams.data;

    const parsedQuery = MemoriesQuery.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsedQuery.error.flatten().fieldErrors,
      });
    }
    const { type, status, limit } = parsedQuery.data;

    const memories = await prisma.memory.findMany({
      where: { projectId, type, status },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        text: true,
        type: true,
        status: true,
        confidence: true,
        importance: true,
        createdAt: true,
        sourceMessageId: true,
      },
    });

    return reply.send(
      memories.map((m) => ({
        memoryId: m.id,
        text: m.text,
        type: m.type,
        status: m.status,
        confidence: m.confidence,
        importance: m.importance,
        createdAt: m.createdAt.toISOString(),
        sourceMessageId: m.sourceMessageId,
      })),
    );
  });

  /**
   * GET /v1/projects/:projectId/memories/:memoryId/explain
   *
   * Returns full provenance for a memory:
   *  - The memory itself (text, type, status, confidence)
   *  - Source message (the conversation turn that produced it)
   *  - Entity mentions (which entities this fact references)
   *  - Similar memories (top 5, all statuses — shows consolidation neighbors)
   */
  fastify.get("/memories/:memoryId/explain", async (request, reply) => {
    const parsedParams = MemoryParams.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsedParams.error.flatten().fieldErrors,
      });
    }

    const { projectId, memoryId } = parsedParams.data;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return reply
        .status(404)
        .send({ error: "Project not found", details: null });
    }

    // Fetch memory with provenance
    const memory = await getMemoryWithProvenance(memoryId, projectId);

    if (!memory) {
      return reply
        .status(404)
        .send({ error: "Memory not found", details: null });
    }

    // Find similar memories (across all statuses) for consolidation history
    const similarMemories = await findSimilarMemoriesByMemoryId({
      memoryId,
      projectId,
      k: 5,
    });

    return reply.send({
      memory: {
        id: memory.id,
        text: memory.text,
        type: memory.type,
        status: memory.status,
        confidence: memory.confidence,
        importance: memory.importance,
        createdAt: memory.createdAt.toISOString(),
        updatedAt: memory.updatedAt.toISOString(),
      },
      evidence: memory.sourceMessage
        ? {
            messageId: memory.sourceMessage.id,
            role: memory.sourceMessage.role,
            content: memory.sourceMessage.content,
            createdAt: memory.sourceMessage.createdAt.toISOString(),
          }
        : null,
      entityMentions: memory.mentions.map((m) => ({
        entityId: m.entity.id,
        name: m.entity.name,
        kind: m.entity.kind,
      })),
      similarMemories: similarMemories.map((s) => ({
        memoryId: s.memoryId,
        text: s.text,
        type: s.type,
        status: s.status,
        similarity: Number(s.similarity.toFixed(4)),
      })),
    });
  });
};
