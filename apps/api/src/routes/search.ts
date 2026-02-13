import type { FastifyPluginAsync } from "fastify";
import { prisma, searchMemoriesByVector } from "@memo-mesh/db";
import { generateEmbedding } from "@memo-mesh/llm";
import { SearchMemoriesBody } from "@memo-mesh/shared";

/**
 * Compute a recency boost between 0 and 1.
 * Memories created now get 1.0, memories 30+ days old get ~0.
 */
function recencyBoost(createdAt: Date): number {
  const ageMs = Date.now() - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  // Exponential decay: half-life of ~7 days
  return Math.exp(-ageDays / 7);
}

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/memories/search", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    const parsed = SearchMemoriesBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { query, k, includeRaw } = parsed.data;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Vector similarity search
    const results = await searchMemoriesByVector({
      projectId,
      queryEmbedding,
      k,
      includeRaw,
    });

    // Apply ranking: finalScore = similarity * 0.9 + recencyBoost * 0.1
    const items = results.map((r) => {
      const boost = recencyBoost(r.createdAt);
      return {
        memoryId: r.memoryId,
        text: r.text,
        type: r.type,
        similarity: Number(r.similarity.toFixed(4)),
        recencyBoost: Number(boost.toFixed(4)),
        finalScore: Number((r.similarity * 0.9 + boost * 0.1).toFixed(4)),
        createdAt: r.createdAt.toISOString(),
      };
    });

    // Sort by finalScore descending
    items.sort((a, b) => b.finalScore - a.finalScore);

    return reply.send({ items });
  });
};
