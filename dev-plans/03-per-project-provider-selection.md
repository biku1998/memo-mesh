# Per-Project Provider Selection

## Context

Projects already have a `provider` field ("openai" | "anthropic") in the database, but it's just metadata — the UI doesn't let users choose it at creation time (defaults to "openai" silently) and there's no way to change it later. The LLM package also ignores it, always resolving the global OpenAI key.

**Goal**: Make the `Project.provider` field meaningful:
1. At project creation, show a provider selector based on which global keys are configured
2. If only one key is available, auto-select and disable the dropdown
3. Allow changing the provider inline on the project list
4. Wire the provider field through the LLM layer so the correct key is used

**No new DB models needed** — `Project.provider` and global `ProviderKey` already exist.

---

## Implementation Steps

### 1. API — Add `PATCH /v1/projects/:projectId` endpoint

**File:** [projects.ts](apps/api/src/routes/projects.ts)

- New endpoint: `PATCH /v1/projects/:projectId` (session auth + ownership check)
- Body: `{ provider: "openai" | "anthropic" }` (validated with Zod)
- Updates `project.provider` in DB
- Returns updated project `{ id, name, provider, createdAt }`

### 2. packages/shared — Add `UpdateProjectBody` schema

**File:** [auth.ts](packages/shared/src/schemas/auth.ts)

- Add schema:
  ```typescript
  export const UpdateProjectBody = z.object({
    provider: z.enum(["openai", "anthropic"]),
  });
  ```

### 3. packages/llm — Use project's provider for key resolution

**File:** [openai-key.ts](packages/llm/src/openai-key.ts)

- Rename to something more generic (e.g., `provider-key.ts`) or add a new function
- Add: `getProviderApiKey(provider: string): Promise<string>`
  - Fetches global DB key for the given provider → falls back to env var (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`) → throws
- Keep `getOpenAIApiKey()` as a wrapper calling `getProviderApiKey("openai")` for backward compat

**File:** [embeddings.ts](packages/llm/src/embeddings.ts)

- Add optional `provider` param to `generateEmbedding(text, provider?)` and `generateEmbeddings(texts, provider?)`
- Resolve key via `getProviderApiKey(provider ?? "openai")`
- Note: Embeddings currently only support OpenAI (`text-embedding-3-small`). For now, always use the OpenAI key for embeddings regardless of project provider. The `provider` field on the project controls the extraction model only. (We can expand this later.)

**File:** [extraction.ts](packages/llm/src/extraction.ts)

- Add optional `provider` param to `extractKnowledge(content, provider?)`
- If provider is "openai": use `gpt-4o-mini` via `@ai-sdk/openai` (current behavior)
- If provider is "anthropic": use appropriate model via `@ai-sdk/anthropic` (need to add this dependency to `packages/llm`)
- Key resolution: `getProviderApiKey(provider ?? "openai")`

**Wait — Anthropic extraction support**: This requires adding `@ai-sdk/anthropic` as a dependency and creating an Anthropic model in extraction. Since the Vercel AI SDK abstracts this via `generateObject`, the change is straightforward — just swap the model based on provider.

### 4. apps/api — Pass project provider to LLM calls

**File:** [messages.ts](apps/api/src/routes/messages.ts)

The `project` object is already fetched (line 194). Pass `project.provider` to LLM calls:
- Line 223: `generateEmbedding(content)` — keep as-is (embeddings always use OpenAI for now)
- Line 233: `extractKnowledge(content)` → `extractKnowledge(content, project.provider)`
- Line 69 (in `processExtraction`): `generateEmbedding(fact.text)` — keep as-is (embeddings)

**File:** [search.ts](apps/api/src/routes/search.ts)

- Line 151: `generateEmbedding(query)` — keep as-is (embeddings always OpenAI)

### 5. apps/web — API client

**File:** [api.ts](apps/web/src/lib/api.ts)

- Update `createProject(name, provider)` — already accepts provider param, just need to make sure it's passed from UI
- Add `updateProject(projectId, provider)` → `PATCH /v1/projects/:projectId`
- `getProviderKeys()` already exists — reuse to check which keys are configured

### 6. apps/web — Provider selector in create project form

**File:** [ProjectsPage.tsx](apps/web/src/pages/ProjectsPage.tsx)

In the create form:
- Fetch configured provider keys via `useQuery({ queryKey: ["providerKeys"], queryFn: getProviderKeys })`
- Add a `Select` dropdown for provider (openai / anthropic)
- Disable options whose keys are not configured (gray out + tooltip "No API key configured")
- If only one key is configured: auto-select it, disable the dropdown, show a note like "Only OpenAI key is configured"
- If no keys are configured: show a warning linking to `/settings`
- Pass selected provider to `createProject(name, provider)`

### 7. apps/web — Inline provider change on project list

**File:** [ProjectsPage.tsx](apps/web/src/pages/ProjectsPage.tsx)

On each project card:
- Replace the static `{p.provider}` text with a small `Select` dropdown (or clickable badge that opens a select)
- On change: call `updateProject(projectId, newProvider)` → invalidate `["projects"]` query
- Same rules: disable unavailable providers, show toast on success/error
- Keep it minimal — a compact inline select, not a full form

---

## Files Modified (summary)

| File | Change |
|------|--------|
| [auth.ts](packages/shared/src/schemas/auth.ts) | Add `UpdateProjectBody` schema |
| [projects.ts](apps/api/src/routes/projects.ts) | Add `PATCH /v1/projects/:projectId` endpoint |
| [openai-key.ts](packages/llm/src/openai-key.ts) | Add generic `getProviderApiKey(provider)` |
| [extraction.ts](packages/llm/src/extraction.ts) | Accept provider param, support Anthropic model |
| [messages.ts](apps/api/src/routes/messages.ts) | Pass `project.provider` to `extractKnowledge` |
| [api.ts](apps/web/src/lib/api.ts) | Add `updateProject()` function |
| [ProjectsPage.tsx](apps/web/src/pages/ProjectsPage.tsx) | Provider selector in create form + inline change on project cards |
| `packages/llm/package.json` | Add `@ai-sdk/anthropic` dependency |

## Verification

1. `pnpm typecheck` — no type errors
2. `pnpm dev` — API + web start without errors
3. Go to `/settings` → configure an OpenAI key
4. Go to `/projects` → click "New project" → provider dropdown shows OpenAI selected (Anthropic disabled/grayed since no key)
5. Create the project → card shows "openai" with inline selector
6. Go to `/settings` → add an Anthropic key
7. Back to `/projects` → inline selector now allows switching to "anthropic"
8. Switch a project to Anthropic → send a message via workbench → extraction uses Anthropic model
9. Verify embeddings still work (always OpenAI regardless of project provider)
