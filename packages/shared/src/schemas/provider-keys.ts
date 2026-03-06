import { z } from "zod";

export const ProviderEnum = z.enum(["openai", "anthropic"]);

export const UpsertProviderKeyBody = z.object({
  provider: ProviderEnum,
  key: z.string().min(1, "API key is required"),
});
export type UpsertProviderKeyBody = z.infer<typeof UpsertProviderKeyBody>;

export const DeleteProviderKeyParams = z.object({
  provider: ProviderEnum,
});
export type DeleteProviderKeyParams = z.infer<typeof DeleteProviderKeyParams>;

export const ProviderKeyInfo = z.object({
  provider: z.string(),
  maskedKey: z.string(),
  updatedAt: z.string(),
});
export type ProviderKeyInfo = z.infer<typeof ProviderKeyInfo>;
