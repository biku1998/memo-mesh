import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { ExtractionResult } from "@memo-mesh/shared";

const extractionModel = openai("gpt-4o-mini");

const EXTRACTION_PROMPT = `You are a knowledge extraction system. Given a user message, extract structured knowledge.

Extract:
1. **Entities**: People, places, organizations, products, concepts mentioned. Include the user themselves if relevant (as "user").
2. **Facts**: Stable preferences, traits, constraints, biographical details. Each fact should be a single, self-contained statement. Assign a confidence score (0-1) based on how certain the statement is. Optionally assign importance (0-1) for how useful this is for personalization.
3. **Relations**: Subject-predicate-object triples connecting entities (e.g., "user" - "prefers" - "TypeScript").

Rules:
- Only extract facts that are likely to be stable/persistent (preferences, traits, biographical info).
- Do NOT extract transient information (what the user is doing right now, greetings, questions).
- If the message contains no extractable knowledge, return empty arrays.
- Keep fact text concise but complete.
- Entity names should be specific (e.g., "TypeScript" not "a programming language").
- Use "user" as the entity name for the person speaking.`;

export async function extractKnowledge(
  content: string,
): Promise<ExtractionResult> {
  const { object } = await generateObject({
    model: extractionModel,
    schema: ExtractionResult,
    prompt: `${EXTRACTION_PROMPT}\n\nMessage: "${content}"`,
  });

  return object;
}
