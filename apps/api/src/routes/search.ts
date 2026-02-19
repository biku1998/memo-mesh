import type { FastifyPluginAsync } from "fastify";
import { prisma, searchMemoriesByVector, getMemoriesWithEntityMentions } from "@memo-mesh/db";
import { generateEmbedding } from "@memo-mesh/llm";
import {
  ProjectParams,
  SearchMemoriesBody,
  type ContextPack,
  type ContextPackFact,
  type ContextPackEntity,
} from "@memo-mesh/shared";

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

interface RankedItem {
  memoryId: string;
  text: string;
  type: string;
  similarity: number;
  recencyBoost: number;
  finalScore: number;
  createdAt: string;
}

/**
 * Build a ContextPack from ranked fact items.
 * Groups facts by the entities they mention; unlinked facts go in unattachedFacts.
 */
async function buildContextPack(factItems: RankedItem[]): Promise<ContextPack> {
  if (factItems.length === 0) {
    return {
      summary: "No relevant facts found.",
      entities: [],
      unattachedFacts: [],
      totalFacts: 0,
    };
  }

  const factMemoryIds = factItems.map((f) => f.memoryId);
  const memoriesWithMentions = await getMemoriesWithEntityMentions(factMemoryIds);

  // Build a lookup: memoryId → mention data
  const mentionMap = new Map(memoriesWithMentions.map((m) => [m.memoryId, m]));

  // entity ID → ContextPackEntity (accumulate facts)
  const entityMap = new Map<string, ContextPackEntity>();
  const attachedMemoryIds = new Set<string>();

  for (const item of factItems) {
    const mem = mentionMap.get(item.memoryId);
    if (!mem || mem.entityMentions.length === 0) continue;

    const packFact: ContextPackFact = {
      memoryId: item.memoryId,
      text: item.text,
      confidence: mem.confidence,
      finalScore: item.finalScore,
      evidenceMessageId: mem.sourceMessageId,
    };

    attachedMemoryIds.add(item.memoryId);

    for (const mention of mem.entityMentions) {
      if (!entityMap.has(mention.entityId)) {
        entityMap.set(mention.entityId, {
          entityId: mention.entityId,
          name: mention.entity.name,
          kind: mention.entity.kind,
          facts: [],
        });
      }
      entityMap.get(mention.entityId)!.facts.push(packFact);
    }
  }

  // Unattached facts — facts with no entity mentions
  const unattachedFacts: ContextPackFact[] = factItems
    .filter((item) => !attachedMemoryIds.has(item.memoryId))
    .map((item) => {
      const mem = mentionMap.get(item.memoryId);
      return {
        memoryId: item.memoryId,
        text: item.text,
        confidence: mem?.confidence ?? null,
        finalScore: item.finalScore,
        evidenceMessageId: mem?.sourceMessageId ?? null,
      };
    });

  const entities = Array.from(entityMap.values());
  const totalFacts = factItems.length;

  // Brief narrative summary
  const entityNames = entities
    .slice(0, 3)
    .map((e) => e.name)
    .join(", ");
  const entitySuffix =
    entities.length > 3 ? `, +${entities.length - 3} more` : "";
  const summary =
    entities.length > 0
      ? `Found ${totalFacts} fact${totalFacts !== 1 ? "s" : ""} across ${entities.length} entit${entities.length !== 1 ? "ies" : "y"} (${entityNames}${entitySuffix}).`
      : `Found ${totalFacts} fact${totalFacts !== 1 ? "s" : ""} with no entity associations.`;

  return { summary, entities, unattachedFacts, totalFacts };
}

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/memories/search", async (request, reply) => {
    // Validate params
    const parsedParams = ProjectParams.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsedParams.error.flatten().fieldErrors,
      });
    }

    const { projectId } = parsedParams.data;

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
      return reply
        .status(404)
        .send({ error: "Project not found", details: null });
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
    const items: RankedItem[] = results.map((r) => {
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

    // Build context pack from fact items only
    const factItems = items.filter((item) => item.type === "fact");
    const contextPack = await buildContextPack(factItems);

    return reply.send({ items, contextPack });
  });
};
