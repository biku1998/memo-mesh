import { z } from "zod";

export const SearchMemoriesBody = z.object({
  query: z.string().min(1, "Query must not be empty"),
  k: z.number().int().min(1).max(50).default(10),
  includeRaw: z.boolean().default(false),
});

export type SearchMemoriesBody = z.infer<typeof SearchMemoriesBody>;

export const SearchMemoryItem = z.object({
  memoryId: z.string(),
  text: z.string(),
  type: z.string(),
  similarity: z.number(),
  recencyBoost: z.number(),
  finalScore: z.number(),
  createdAt: z.string(),
});

export type SearchMemoryItem = z.infer<typeof SearchMemoryItem>;

export const SearchMemoriesResponse = z.object({
  items: z.array(SearchMemoryItem),
});

export type SearchMemoriesResponse = z.infer<typeof SearchMemoriesResponse>;
