import type { FastifyPluginAsync } from "fastify";
import {
  prisma,
  storeMemoryEmbedding,
  findSimilarActiveFacts,
  supersedeMemory,
} from "@memo-mesh/db";
import { generateEmbedding, extractKnowledge } from "@memo-mesh/llm";
import { z } from "zod";
import {
  ProjectParams,
  CreateMessageBody,
  normalizeEntityName,
  type ExtractionResult,
} from "@memo-mesh/shared";

const GetMessagesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

async function processExtraction(
  projectId: string,
  messageId: string,
  extraction: ExtractionResult,
  log: { error: (obj: unknown, msg: string) => void },
): Promise<void> {
  // Build a map of normalized entity name → entity ID for relation linking
  const entityMap = new Map<string, string>();

  // 1. Upsert entities
  for (const entity of extraction.entities) {
    const normalized = normalizeEntityName(entity.name);
    const upserted = await prisma.entity.upsert({
      where: {
        projectId_normalizedName_kind: {
          projectId,
          normalizedName: normalized,
          kind: entity.kind.toLowerCase(),
        },
      },
      update: {},
      create: {
        projectId,
        name: entity.name,
        normalizedName: normalized,
        kind: entity.kind.toLowerCase(),
      },
    });
    entityMap.set(normalized, upserted.id);
  }

  // 2. Store facts as Memory records + embed + consolidate + link entity mentions
  const CONSOLIDATION_THRESHOLD = 0.70;

  for (const fact of extraction.facts) {
    const factMemory = await prisma.memory.create({
      data: {
        projectId,
        type: "fact",
        text: fact.text,
        confidence: fact.confidence,
        importance: fact.importance ?? null,
        sourceMessageId: messageId,
      },
    });

    // Embed the fact (awaited — needed for consolidation)
    try {
      const embedding = await generateEmbedding(fact.text);
      await storeMemoryEmbedding(factMemory.id, embedding);

      // Consolidation: find similar active facts and supersede them
      const similar = await findSimilarActiveFacts({
        projectId,
        embedding,
        threshold: CONSOLIDATION_THRESHOLD,
        excludeMemoryId: factMemory.id,
      });

      for (const match of similar) {
        await supersedeMemory(match.memoryId);
      }
    } catch (err) {
      log.error({ err, memoryId: factMemory.id }, "Failed to embed/consolidate fact");
    }

    // Create entity mentions for this fact
    for (const entityName of fact.entities) {
      const normalized = normalizeEntityName(entityName);
      const entityId = entityMap.get(normalized);
      if (entityId) {
        await prisma.entityMention.create({
          data: { entityId, memoryId: factMemory.id },
        });
      }
    }
  }

  // 3. Store relations
  for (const relation of extraction.relations) {
    const subjectNorm = normalizeEntityName(relation.subject);
    const objectNorm = normalizeEntityName(relation.object);
    const subjectId = entityMap.get(subjectNorm);
    const objectId = entityMap.get(objectNorm);

    if (!subjectId || !objectId) continue;

    // Find the first fact memory as evidence
    const evidenceMemory = await prisma.memory.findFirst({
      where: { projectId, sourceMessageId: messageId, type: "fact" },
      orderBy: { createdAt: "asc" },
    });

    if (!evidenceMemory) continue;

    await prisma.relation.create({
      data: {
        projectId,
        subjectEntityId: subjectId,
        predicate: relation.predicate,
        objectEntityId: objectId,
        confidence: relation.confidence ?? null,
        evidenceMemoryId: evidenceMemory.id,
      },
    });
  }
}

export const messageRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/projects/:projectId/messages?limit=20
   * Returns recent messages for a project, newest first.
   */
  fastify.get("/messages", async (request, reply) => {
    const parsedParams = ProjectParams.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsedParams.error.flatten().fieldErrors,
      });
    }
    const { projectId } = parsedParams.data;

    const parsedQuery = GetMessagesQuery.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsedQuery.error.flatten().fieldErrors,
      });
    }
    const { limit } = parsedQuery.data;

    const messages = await prisma.message.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, role: true, content: true, createdAt: true },
    });

    return reply.send(
      messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    );
  });

  fastify.post("/messages", async (request, reply) => {
    // Validate params
    const parsedParams = ProjectParams.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsedParams.error.flatten().fieldErrors,
      });
    }

    const { projectId } = parsedParams.data;

    // Validate body
    const parsed = CreateMessageBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { role, content } = parsed.data;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return reply
        .status(404)
        .send({ error: "Project not found", details: null });
    }

    // Store message + raw memory atomically
    const { message, memory } = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: { projectId, role, content },
      });

      const mem = await tx.memory.create({
        data: {
          projectId,
          type: "raw",
          text: content,
          sourceMessageId: msg.id,
        },
      });

      return { message: msg, memory: mem };
    });

    // Generate and store embedding for raw memory (fire-and-forget)
    generateEmbedding(content)
      .then((embedding) => storeMemoryEmbedding(memory.id, embedding))
      .catch((err) => {
        fastify.log.error(
          { err, memoryId: memory.id },
          "Failed to embed memory",
        );
      });

    // Extract knowledge and store facts/entities/relations (fire-and-forget)
    extractKnowledge(content)
      .then((extraction) =>
        processExtraction(projectId, message.id, extraction, fastify.log),
      )
      .catch((err) => {
        fastify.log.error(
          { err, messageId: message.id },
          "Failed to extract knowledge",
        );
      });

    return reply.status(201).send({ messageId: message.id });
  });
};
