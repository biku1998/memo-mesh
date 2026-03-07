# Require OpenAI Key for Project Creation

## Context

Embeddings always use OpenAI's `text-embedding-3-small` regardless of the project's provider setting. An OpenAI API key is therefore always required for any project to function (messages → embeddings → vector search). Currently, the frontend only checks DB-stored keys via `GET /v1/admin/provider-keys` to determine provider availability, missing keys configured via env vars (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`). We need to:

1. Expose true provider availability (DB + env var) to the frontend
2. Gate project creation on OpenAI being available (since embeddings require it)

---

## Implementation Steps

### Step 1: Export `getProviderApiKey` from `@memo-mesh/llm`

**File:** `packages/llm/src/index.ts`

Add: `export { getProviderApiKey } from "./provider-key.js";`

Then rebuild: `pnpm --filter @memo-mesh/llm build`

### Step 2: Add `GET /v1/admin/provider-availability` endpoint

**File:** `apps/api/src/routes/providerKeys.ts`

New endpoint inside the existing `providerKeyRoutes` plugin. For each provider (`"openai"`, `"anthropic"`): try calling `getProviderApiKey(provider)` — if it resolves, `available: true`; if it throws, `available: false`. Requires session auth.

```typescript
import { getProviderApiKey } from "@memo-mesh/llm";

// GET /v1/admin/provider-availability
fastify.get("/v1/admin/provider-availability", async (request, reply) => {
  const userId = request.session.userId;
  if (!userId) return reply.status(401).send({ error: "Not authenticated" });

  const providers = ["openai", "anthropic"] as const;
  const result = await Promise.all(
    providers.map(async (provider) => {
      try {
        await getProviderApiKey(provider);
        return { provider, available: true };
      } catch {
        return { provider, available: false };
      }
    }),
  );
  return reply.send(result);
});
```

### Step 3: Add API client function

**File:** `apps/web/src/lib/api.ts`

```typescript
export interface ProviderAvailability {
  provider: string;
  available: boolean;
}

export function getProviderAvailability() {
  return request<ProviderAvailability[]>("/v1/admin/provider-availability");
}
```

### Step 4: Update `useConfiguredProviders` hook + gating logic

**File:** `apps/web/src/pages/ProjectsPage.tsx`

- Change `useConfiguredProviders()` to call `getProviderAvailability()` instead of `getProviderKeys()`
- Query key: `["providerAvailability"]`
- Build `configured` set from items where `available === true`
- Replace `noKeysConfigured` check with `openaiMissing = providersLoaded && !configured.has("openai")`
- Update warning message from "No provider keys configured" → "OpenAI API key is required for project creation (used for embeddings). Please configure it in Settings."
- Disable the "Create" button when `openaiMissing` instead of when no keys at all

### Step 5: Invalidate availability cache on key changes + block OpenAI removal

**File:** `apps/web/src/pages/SettingsPage.tsx`

**5a.** After both existing `invalidateQueries({ queryKey: ["provider-keys"] })` calls (line 39 in `handleSubmit`, line 66 in `handleDelete`), also add:

```typescript
await qc.invalidateQueries({ queryKey: ["providerAvailability"] });
```

**5b.** Block removal of the OpenAI key entirely — disable the "Remove" button for OpenAI and show a reason. OpenAI is always required for embeddings, so it should never be removable.

- In the provider list rendering (around line 118), when `p === "openai"` and the key exists: disable the Remove button and add a tooltip/title: `"OpenAI key is required for embeddings and cannot be removed"`
- The Anthropic Remove button remains unchanged

---

## Files Modified

| File | Change |
|------|--------|
| `packages/llm/src/index.ts` | Export `getProviderApiKey` |
| `apps/api/src/routes/providerKeys.ts` | Add `GET /v1/admin/provider-availability` endpoint |
| `apps/web/src/lib/api.ts` | Add `ProviderAvailability` type + `getProviderAvailability()` |
| `apps/web/src/pages/ProjectsPage.tsx` | Update hook to use availability endpoint; gate on OpenAI specifically |
| `apps/web/src/pages/SettingsPage.tsx` | Invalidate `providerAvailability` query on key upsert/delete |

## Verification

1. `pnpm --filter @memo-mesh/llm build` — export compiles
2. `pnpm typecheck` — no type errors
3. Remove all OpenAI keys (DB + env) → Projects page shows warning, Create button disabled
4. Add OpenAI key via Settings → warning disappears, can create projects
5. Set only env var `OPENAI_API_KEY` (no DB key) → Projects page correctly shows OpenAI as available
6. Anthropic-only (no OpenAI) → still blocked from creating projects with clear message
