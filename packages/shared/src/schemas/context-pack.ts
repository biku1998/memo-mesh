import { z } from "zod";

export const ContextPackFact = z.object({
  memoryId: z.string(),
  text: z.string(),
  confidence: z.number().nullable(),
  finalScore: z.number(),
  evidenceMessageId: z.string().nullable(),
});

export type ContextPackFact = z.infer<typeof ContextPackFact>;

export const ContextPackEntity = z.object({
  entityId: z.string(),
  name: z.string(),
  kind: z.string(),
  facts: z.array(ContextPackFact),
});

export type ContextPackEntity = z.infer<typeof ContextPackEntity>;

export const ContextPack = z.object({
  /** Short narrative describing what was found. */
  summary: z.string(),
  /** Facts grouped by the entities they mention. */
  entities: z.array(ContextPackEntity),
  /** Facts with no entity mentions. */
  unattachedFacts: z.array(ContextPackFact),
  /** Total number of fact memories included. */
  totalFacts: z.number(),
});

export type ContextPack = z.infer<typeof ContextPack>;
