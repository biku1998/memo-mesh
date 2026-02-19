import { prisma } from "./index.js";

export interface MemoryEntityMention {
  entityId: string;
  entity: { name: string; kind: string };
}

export interface MemoryWithMentions {
  memoryId: string;
  confidence: number | null;
  sourceMessageId: string | null;
  entityMentions: MemoryEntityMention[];
}

/**
 * Fetch entity mentions (with entity details) for a list of memory IDs.
 * Used to group facts by entity when building the context pack.
 */
export async function getMemoriesWithEntityMentions(
  memoryIds: string[],
): Promise<MemoryWithMentions[]> {
  if (memoryIds.length === 0) return [];

  const memories = await prisma.memory.findMany({
    where: { id: { in: memoryIds } },
    select: {
      id: true,
      confidence: true,
      sourceMessageId: true,
      mentions: {
        select: {
          entityId: true,
          entity: { select: { name: true, kind: true } },
        },
      },
    },
  });

  return memories.map((m) => ({
    memoryId: m.id,
    confidence: m.confidence,
    sourceMessageId: m.sourceMessageId,
    entityMentions: m.mentions,
  }));
}

/**
 * Fetch a single memory with full provenance for the /explain endpoint.
 * Returns the memory, its source message, and all entity mentions.
 */
export async function getMemoryWithProvenance(
  memoryId: string,
  projectId: string,
) {
  return prisma.memory.findFirst({
    where: { id: memoryId, projectId },
    include: {
      sourceMessage: {
        select: { id: true, role: true, content: true, createdAt: true },
      },
      mentions: {
        include: {
          entity: {
            select: { id: true, name: true, kind: true },
          },
        },
      },
    },
  });
}
