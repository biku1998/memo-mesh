/**
 * Normalize an entity name for deduplication.
 * Lowercases, trims whitespace, and collapses multiple spaces.
 */
export function normalizeEntityName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}
