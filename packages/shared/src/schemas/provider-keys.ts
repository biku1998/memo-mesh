import { z } from "zod";

export const UpsertProviderKeyBody = z.object({
  provider: z.enum(["openai", "anthropic"]),
  key: z.string().min(1, "API key is required"),
});
export type UpsertProviderKeyBody = z.infer<typeof UpsertProviderKeyBody>;

export const ProviderKeyInfo = z.object({
  provider: z.string(),
  maskedKey: z.string(),
  updatedAt: z.string(),
});
export type ProviderKeyInfo = z.infer<typeof ProviderKeyInfo>;
