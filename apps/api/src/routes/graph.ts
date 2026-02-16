import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@memo-mesh/db";
import { ProjectParams } from "@memo-mesh/shared";
import { z } from "zod";

const GraphQuery = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 100))
    .pipe(z.number().int().min(1).max(500)),
});

const EntityParams = ProjectParams.extend({
  entityId: z.string().min(1, "entityId is required"),
});

export const graphRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /graph — returns nodes (entities) and edges (relations) for a project
  fastify.get("/graph", async (request, reply) => {
    const parsedParams = ProjectParams.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsedParams.error.flatten().fieldErrors,
      });
    }

    const { projectId } = parsedParams.data;

    const parsedQuery = GraphQuery.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsedQuery.error.flatten().fieldErrors,
      });
    }

    const { limit } = parsedQuery.data;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return reply
        .status(404)
        .send({ error: "Project not found", details: null });
    }

    const [nodes, edges] = await Promise.all([
      prisma.entity.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.relation.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    return reply.send({
      nodes: nodes.map((e) => ({
        id: e.id,
        name: e.name,
        normalizedName: e.normalizedName,
        kind: e.kind,
        createdAt: e.createdAt.toISOString(),
      })),
      edges: edges.map((r) => ({
        id: r.id,
        subjectEntityId: r.subjectEntityId,
        predicate: r.predicate,
        objectEntityId: r.objectEntityId,
        confidence: r.confidence,
        evidenceMemoryId: r.evidenceMemoryId,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  });

  // GET /graph/entity/:entityId — entity details + relations + evidence
  fastify.get("/graph/entity/:entityId", async (request, reply) => {
    const parsedParams = EntityParams.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsedParams.error.flatten().fieldErrors,
      });
    }

    const { projectId, entityId } = parsedParams.data;

    const entity = await prisma.entity.findUnique({
      where: { id: entityId },
    });

    if (!entity || entity.projectId !== projectId) {
      return reply
        .status(404)
        .send({ error: "Entity not found", details: null });
    }

    const [outgoing, incoming, mentions] = await Promise.all([
      prisma.relation.findMany({
        where: { subjectEntityId: entityId },
        include: {
          objectEntity: { select: { id: true, name: true, kind: true } },
          evidenceMemory: { select: { id: true, text: true, type: true } },
        },
      }),
      prisma.relation.findMany({
        where: { objectEntityId: entityId },
        include: {
          subjectEntity: { select: { id: true, name: true, kind: true } },
          evidenceMemory: { select: { id: true, text: true, type: true } },
        },
      }),
      prisma.entityMention.findMany({
        where: { entityId },
        include: {
          memory: {
            select: { id: true, text: true, type: true, createdAt: true },
          },
        },
      }),
    ]);

    return reply.send({
      entity: {
        id: entity.id,
        name: entity.name,
        normalizedName: entity.normalizedName,
        kind: entity.kind,
        createdAt: entity.createdAt.toISOString(),
      },
      relations: {
        outgoing: outgoing.map((r) => ({
          id: r.id,
          predicate: r.predicate,
          target: r.objectEntity,
          confidence: r.confidence,
          evidence: r.evidenceMemory,
        })),
        incoming: incoming.map((r) => ({
          id: r.id,
          predicate: r.predicate,
          source: r.subjectEntity,
          confidence: r.confidence,
          evidence: r.evidenceMemory,
        })),
      },
      mentions: mentions.map((m) => ({
        memoryId: m.memory.id,
        text: m.memory.text,
        type: m.memory.type,
        createdAt: m.memory.createdAt.toISOString(),
      })),
    });
  });
};
