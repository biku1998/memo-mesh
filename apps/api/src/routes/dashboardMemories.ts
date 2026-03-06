import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "@memo-mesh/db";

const ParamsSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
});

const QuerySchema = z.object({
  type: z.enum(["fact", "raw"]).optional(),
  status: z.enum(["active", "superseded"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const dashboardMemoryRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/projects/:projectId/dashboard/memories
  // Session-auth, cursor-based pagination, optional type/status filters
  fastify.get("/v1/projects/:projectId/dashboard/memories", async (request, reply) => {
    const userId = request.session.userId;
    if (!userId) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    const parsedParams = ParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({ error: parsedParams.error.issues[0]?.message ?? "Invalid params" });
    }
    const { projectId } = parsedParams.data;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    });
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const parsedQuery = QuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.status(400).send({ error: parsedQuery.error.issues[0]?.message ?? "Invalid query params" });
    }
    const { type, status, cursor, limit } = parsedQuery.data;

    const rows = await prisma.memory.findMany({
      where: {
        projectId,
        ...(type && { type }),
        ...(status && { status }),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
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

    const hasMore = rows.length > limit;
    const memories = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? memories[memories.length - 1].id : null;

    return reply.send({
      memories: memories.map((m) => ({
        memoryId: m.id,
        text: m.text,
        type: m.type,
        status: m.status,
        confidence: m.confidence,
        importance: m.importance,
        createdAt: m.createdAt.toISOString(),
        sourceMessageId: m.sourceMessageId,
      })),
      nextCursor,
      hasMore,
    });
  });
};
