import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getDecryptedProviderApiKey } from "@memo-mesh/db";
import { ExtractionResult, type ExtractionResult as ExtractionResultType } from "@memo-mesh/shared";

/**
 * Resolves the OpenAI API key, preferring the encrypted DB value and
 * falling back to the OPENAI_API_KEY env var (useful for local dev).
 */
async function getOpenAIApiKey(): Promise<string> {
  const dbKey = await getDecryptedProviderApiKey("openai");
  const key = dbKey ?? process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OpenAI API key not configured — set OPENAI_API_KEY env var or store it via PUT /v1/admin/provider-keys",
    );
  }
  return key;
}

const EXTRACTION_PROMPT = `You are a knowledge extraction system. Given a user message, extract structured knowledge.

Extract:
1. **Entities**: People, places, organizations, products, concepts mentioned. Include the user themselves if relevant (as "user").
2. **Facts**: Stable preferences, traits, constraints, biographical details. Each fact should be a single, self-contained statement. Assign a confidence score (0-1) based on how certain the statement is. Optionally assign importance (0-1) for how useful this is for personalization. For each fact, list the entity names (from the entities array above) that the fact is about in the "entities" field.
3. **Relations**: Subject-predicate-object triples connecting entities (e.g., "user" - "prefers" - "TypeScript").

Rules:
- Only extract facts that are likely to be stable/persistent (preferences, traits, biographical info).
- Do NOT extract transient information (what the user is doing right now, greetings, questions).
- If the message contains no extractable knowledge, return empty arrays.
- Keep fact text concise but complete.
- Entity names should be specific (e.g., "TypeScript" not "a programming language").
- Use "user" as the entity name for the person speaking.
- The "entities" field on each fact must contain the exact entity names (as strings) that appear in the top-level entities list.`;

const EMPTY_EXTRACTION: ExtractionResultType = {
  entities: [],
  facts: [],
  relations: [],
};

/**
 * Attempt a single structured extraction call via the AI SDK.
 * Returns the validated ExtractionResult or throws on failure.
 */
async function attemptExtraction(content: string, apiKey: string): Promise<ExtractionResultType> {
  const model = createOpenAI({ apiKey })("gpt-4o-mini");
  const { object } = await generateObject({
    model,
    schema: ExtractionResult,
    prompt: `${EXTRACTION_PROMPT}\n\nMessage: "${content}"`,
  });
  return object;
}

/**
 * Try to repair a malformed JSON string and validate against the schema.
 * Handles common LLM failure modes: trailing commas, unquoted keys,
 * missing closing braces/brackets, markdown code fences.
 *
 * Returns the parsed ExtractionResult or null if repair fails.
 */
function repairAndParse(raw: unknown): ExtractionResultType | null {
  try {
    // If the error object carries a raw text payload, try to repair it
    let text: string | undefined;

    if (typeof raw === "string") {
      text = raw;
    } else if (raw && typeof raw === "object" && "text" in raw) {
      text = String((raw as Record<string, unknown>).text);
    }

    if (!text) return null;

    // Strip markdown code fences (```json ... ```)
    let cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

    // Remove trailing commas before } or ]
    cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

    // Attempt to close unclosed braces and brackets (best-effort)
    const opens = (cleaned.match(/{/g) || []).length;
    const closes = (cleaned.match(/}/g) || []).length;
    if (opens > closes) {
      cleaned += "}".repeat(opens - closes);
    }

    const opensArr = (cleaned.match(/\[/g) || []).length;
    const closesArr = (cleaned.match(/\]/g) || []).length;
    if (opensArr > closesArr) {
      cleaned += "]".repeat(opensArr - closesArr);
    }

    const parsed: unknown = JSON.parse(cleaned);
    const result = ExtractionResult.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Extract knowledge from a message with repair + retry-once strategy.
 *
 * 1. First attempt: call generateObject (AI SDK validates against Zod schema).
 * 2. If that fails: try to repair any raw text from the error and validate.
 * 3. If repair fails: retry the LLM call once.
 * 4. If retry fails: return empty extraction (caller logs the error).
 */
export async function extractKnowledge(content: string): Promise<ExtractionResultType> {
  const apiKey = await getOpenAIApiKey();

  // --- Attempt 1 ---
  try {
    return await attemptExtraction(content, apiKey);
  } catch (firstError: unknown) {
    // --- Attempt repair from raw response ---
    const repaired = repairAndParse(firstError);
    if (repaired) return repaired;

    // --- Attempt 2 (retry once) ---
    try {
      return await attemptExtraction(content, apiKey);
    } catch {
      // Both attempts failed — return empty extraction so the pipeline continues.
      // The caller (messages route) logs the top-level error.
      return EMPTY_EXTRACTION;
    }
  }
}
