# MVP plan

I'm planning to build a mini version of something like supermemory or mem0.

Below is a **detailed, “hire-me” MVP plan** tailored to your exact choices: TypeScript everywhere, pnpm monorepo, Fastify + Prisma + Postgres/pgvector, React + TanStack Router dashboard, HTTP-only API, and an MCP server that exposes memory tools (add/search/graph).

---

## MVP north star (demo narrative)

**“Support agent remembers preferences across sessions.”**

**30–60s demo script you should optimize for:**

1. Create a project → paste BYOK keys (OpenAI/Anthropic)
2. Send a few messages like:
   - “I’m vegetarian.”
   - “I prefer morning calls.”
   - “I’m working on payments infra.”

3. Search: “What are my preferences?” → returns concise facts + evidence
4. Open dashboard:
   - **Memories** list shows extracted facts with confidence + “evidence message”
   - **Knowledge graph** shows entities (User → Preference → Vegetarian), relations, and provenance

5. MCP: show an MCP client calling `memory.search` and getting a “context pack” for the agent

This makes you look strong in: systems design, retrieval quality, explainability, UI, and integration standards.

---

## Tech stack (locked)

### Monorepo

- **pnpm workspaces** (monorepo)
- **TypeScript** everywhere

### Backend

- **Fastify** (HTTP API)
- **Prisma ORM**
- **Postgres + pgvector**
  - Prisma can work with Postgres extensions; vector types may require `Unsupported("vector")` patterns depending on your setup, and Prisma has been adding pgvector support in some contexts. ([Prisma][1])

### LLM + embeddings

- **Vercel AI SDK** providers for embeddings + structured extraction from both OpenAI and Anthropic. ([AI SDK][2])
- Optional: if you later want “BYOK without storing keys,” Vercel’s AI Gateway has a BYOK concept—but your current plan is app-level BYOK, which is fine for MVP. ([Vercel][3])

### Frontend dashboard

- React + **TanStack Router**
- Graph visualization: **Cytoscape.js** or **Sigma.js**
  - Cytoscape is easiest to ship quickly; Sigma tends to look more “network graph” polished.

### MCP server

- MCP TypeScript SDK (`@modelcontextprotocol/sdk`) and expose tools only (add/search/graph). ([GitHub][4])

---

## Product scope (MVP constraints you set)

- Single user, multiple projects (no teams)
- Text only (messages) — no files
- Both raw + extracted facts (“memories”) + knowledge graph
- Dashboard is **read-only**
- Keep infra simple at first (no queues/rate limits early); add later

---

## High-level architecture

**Monorepo packages:**

- `apps/api` — Fastify API server
- `apps/web` — React dashboard
- `apps/mcp` — MCP server
- `packages/shared` — zod schemas, types, utils
- `packages/llm` — Vercel AI SDK wrappers (embed/extract)
- `packages/db` — Prisma schema + migrations

**Core flows:**

1. **Ingest** message → store raw message → extract facts/entities/relations → embed → store
2. **Retrieve** memories for a query → vector search + simple rerank → return context pack
3. **Graph** view → fetch nodes/edges with evidence

---

## Data model (Postgres via Prisma)

You want a schema that supports:

- auditability (where did this fact come from?)
- graph visualization
- solid retrieval

### Tables

**Projects**

- `Project { id, name, createdAt }`

**Provider credentials (BYOK)**

- `ProjectProviderKey { id, projectId, provider, encryptedKey, createdAt }`
  - Encrypt with an app secret (see “Security” section)

**Messages (raw)**

- `Message { id, projectId, role, content, createdAt }`

**Memories (structured)**

- `Memory { id, projectId, type, text, importance, confidence, status, createdAt, sourceMessageId }`
  - `type`: `raw | fact | summary` (MVP likely `raw` + `fact`)

**Embeddings**

- `MemoryEmbedding { memoryId, embedding }`
  - `embedding` as vector; with Prisma you may represent as `Unsupported("vector")` and manage indexes in SQL migrations if needed. ([Prisma][1])

**Entities (graph nodes)**

- `Entity { id, projectId, name, normalizedName, kind, createdAt }`

**Relations (graph edges)**

- `Relation { id, projectId, subjectEntityId, predicate, objectEntityId, confidence, evidenceMemoryId, createdAt }`

**Entity mentions (optional in MVP)**

- `EntityMention { entityId, memoryId }`

### MVP indexes (important)

- Vector index on embeddings (IVFFlat / HNSW depending on your pgvector choice)
- `projectId` compound indexes on everything
- Unique constraint on `(projectId, normalizedName, kind)` for entities

---

## LLM design (the part that impresses)

You’ll do two LLM tasks:

1. **Embedding** (for retrieval)
2. **Structured extraction** (facts + entities + relations)

### Extraction output (strict JSON)

Use `zod` schemas and reject/repair invalid output.

Example schema:

- `entities: [{ name, kind }]`
- `facts: [{ text, confidence, importanceHint }]`
- `relations: [{ subject, predicate, object, confidence }]`

**Prompting tactic that reads as “senior”:**

- Tell the model: _extract only stable user preferences / profile / constraints that are useful later; avoid ephemeral details unless explicitly important_.
- Add a rule: _If nothing should be remembered, return empty arrays._

### Consolidation (MVP but meaningful)

When a new fact is extracted:

- Embed it
- Search existing `fact` memories
- If similarity > threshold:
  - either **update** the existing memory (add evidence + bump confidence)
  - or store as a “variant” but mark one as canonical

This prevents memory spam and shows production thinking (without needing queues yet).

---

## API design (HTTP-only, clean, demo-friendly)

All endpoints are scoped by `projectId`.

### Auth

Since it’s single-user, keep it pragmatic:

- Email/password or GitHub OAuth (both are acceptable)
- Issue a session JWT/cookie
- For API usage: issue **project API keys** and require `X-API-Key`

If you use Fastify JWT: `@fastify/jwt` is the standard plugin path. ([GitHub][5])

### Core endpoints

**Projects**

- `POST /v1/projects`
- `GET /v1/projects`

**BYOK keys**

- `PUT /v1/projects/:projectId/keys`
  body: `{ provider: "openai"|"anthropic", apiKey: "..." }`
- `GET /v1/projects/:projectId/keys` (masked metadata only)

**Ingestion**

- `POST /v1/projects/:projectId/messages`
  body: `{ role, content }`
  response: `{ messageId, extracted: { factsCount, entitiesCount, relationsCount } }`

**Search**

- `POST /v1/projects/:projectId/memories/search`
  body: `{ query, k, includeRaw?: boolean }`
  response: `{ items: [...], contextPack: {...} }`

**Read-only dashboard feeds**

- `GET /v1/projects/:projectId/memories?type=fact&cursor=...`
- `GET /v1/projects/:projectId/graph?limit=...`
- `GET /v1/projects/:projectId/graph/entity/:entityId`

**Debug endpoint (very good for hiring)**

- `GET /v1/projects/:projectId/memories/:memoryId/explain`
  - returns: similarity matches, evidence chain, extraction payload

---

## Dashboard plan (read-only, high signal)

### Pages

1. **Project switcher**
2. **Memory Explorer**
   - filter by type/status
   - show extracted facts with confidence + createdAt
   - click → view evidence message + related graph edges

3. **Knowledge Graph**
   - interactive graph
   - click node → side panel with:
     - entity details
     - outgoing/incoming relations
     - evidence memories

4. **Search**
   - search box calling `/memories/search`
   - show results + “context pack preview” (what the agent would receive)

### UX detail that screams “production”

Add an “**Evidence**” icon next to every fact and relation:

- shows the raw message(s) that caused it
- prevents “black-box memory” concerns

---

## MCP server (tools only, per your scope)

Use the TS SDK to expose a thin wrapper over your HTTP API. ([GitHub][4])

### Tools

- `memory.add` → `{ projectId, role, content }`
- `memory.search` → `{ projectId, query, k }`
- `memory.graph` → `{ projectId, limit, cursor }`
- `memory.entity` → `{ projectId, entityId }`

### Output formats

Return:

- `items[]` (memories)
- `contextPack` (structured JSON) like:
  - `profileFacts[]`
  - `preferences[]`
  - `constraints[]`
  - `evidence[]`

This is exactly what agents need: not prose, but structured context.

---

## Security choices (BYOK without scaring recruiters)

You’re accepting user keys—so you must show basic competence:

### MVP-safe approach

- Store provider keys **encrypted at rest**
- Use one server-side master key (`KEY_ENCRYPTION_SECRET`)
- Never log raw keys
- Return only masked metadata in any API response

Add a README note:

- “Keys are encrypted at rest; rotate the master secret to re-encrypt.”
- “For production, use KMS (AWS/GCP) or per-project envelope encryption.”

This is enough for a showcase without overbuilding.

---

## Checkpoints (staged build with acceptance criteria)

No time estimates—just crisp completion gates.

### Stage 1 — Repo + DB foundation

**Deliver**

- pnpm monorepo scaffolding
- Prisma schema + migrations
- Fastify server boots
- Health check endpoint
  **Accept**
- `docker compose up` brings up Postgres + API cleanly

### Stage 2 — Projects + API keys

**Deliver**

- Create/list projects
- Project API key issuance + auth middleware
  **Accept**
- curl calls with `X-API-Key` work across endpoints

### Stage 3 — Message ingestion (raw only)

**Deliver**

- `POST /messages` stores messages
- Memory Explorer shows raw timeline
  **Accept**
- Dashboard lists messages per project

### Stage 4 — Embeddings + semantic search

**Deliver**

- Vercel AI SDK embedding wrapper
- Store embeddings in pgvector
- `/memories/search` returns relevant raw messages
  **Accept**
- Queries work without keyword overlap (semantic match)

### Stage 5 — Fact extraction (structured memories)

**Deliver**

- Extract facts/entities/relations via LLM → validate with zod
- Store `fact` memories with evidence link
  **Accept**
- Enter “I’m vegetarian” → a fact memory appears with evidence

### Stage 6 — Knowledge graph generation

**Deliver**

- Entities + relations persisted
- Graph API endpoint returns nodes/edges
- Graph page renders + side panel evidence
  **Accept**
- Graph meaningfully links entities and relations; clicking shows provenance

### Stage 7 — Consolidation + quality improvements

**Deliver**

- Similarity-based dedupe for facts
- Confidence/importance scoring rules
- “Explain” endpoint for a memory
  **Accept**
- Repeating same preference doesn’t spam duplicates; explain shows why

### Stage 8 — MCP server (tools only)

**Deliver**

- MCP server with `memory.add/search/graph/entity`
- Works against your HTTP API
  **Accept**
- MCP client can call `memory.search` and get a context pack

### Stage 9 — OSS polish for hiring

**Deliver**

- Excellent README + architecture diagram
- Demo script + sample curl commands
- “Design decisions” doc (tradeoffs, future roadmap)
- 2–3 min screen-recorded demo
  **Accept**
- A stranger can run it locally and reproduce your demo reliably

---

## What you should emphasize in your “hire-me” README

1. **Why Postgres-only** (fewer moving parts, still supports vectors + graph tables)
2. **Evidence-first memory** (facts always link back to raw messages)
3. **Strict JSON extraction** (zod validation, retries/repair)
4. **Context pack** output (agent-ready)
5. **MCP integration** (interoperability, modern tooling)

---

## Next steps I’d do immediately (in order)

1. Scaffold monorepo + API + Prisma + Postgres compose
2. Implement Projects + API keys
3. Implement message ingest + raw timeline dashboard
4. Add embeddings + semantic search
5. Add extraction + graph + MCP

If you want, I can also generate:

- a **folder structure** with package.json scripts,
- Prisma schema draft (including pgvector field patterns),
- and the exact **LLM extraction prompt + zod schema** you can paste in.

[1]: https://www.prisma.io/docs/postgres/database/postgres-extensions?utm_source=chatgpt.com "Postgres extensions | Prisma Documentation"
[2]: https://ai-sdk.dev/providers/ai-sdk-providers/openai?utm_source=chatgpt.com "OpenAI Provider"
[3]: https://vercel.com/docs/ai-gateway/authentication-and-byok/byok?utm_source=chatgpt.com "Bring Your Own Key (BYOK)"
[4]: https://github.com/modelcontextprotocol/typescript-sdk?utm_source=chatgpt.com "modelcontextprotocol/typescript-sdk"
[5]: https://github.com/fastify/fastify-jwt?utm_source=chatgpt.com "JWT utils for Fastify"
