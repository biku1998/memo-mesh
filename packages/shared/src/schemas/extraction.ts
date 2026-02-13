import { z } from "zod";

export const ExtractedEntity = z.object({
  name: z.string().min(1),
  kind: z.string().min(1),
});

export type ExtractedEntity = z.infer<typeof ExtractedEntity>;

export const ExtractedFact = z.object({
  text: z.string().min(1),
  confidence: z.number().min(0).max(1),
  importance: z.number().min(0).max(1).optional(),
  entities: z.array(z.string()).default([]),
});

export type ExtractedFact = z.infer<typeof ExtractedFact>;

export const ExtractedRelation = z.object({
  subject: z.string().min(1),
  predicate: z.string().min(1),
  object: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
});

export type ExtractedRelation = z.infer<typeof ExtractedRelation>;

export const ExtractionResult = z.object({
  entities: z.array(ExtractedEntity).default([]),
  facts: z.array(ExtractedFact).default([]),
  relations: z.array(ExtractedRelation).default([]),
});

export type ExtractionResult = z.infer<typeof ExtractionResult>;
