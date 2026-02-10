# MVP Plan - Final

A self-hostable memory layer for LLM agents, similar to Supermemory/Mem0. Enables agents to remember user preferences, constraints, and context across sessions through structured fact extraction, semantic search, and a knowledge graph.

**Target user persona**: Developers integrating this memory layer into their agents via HTTP API or MCP.

**Deployment model**: Self-hosted on a simple VPS (similar to Supabase/Listmonk). Easy to run with Docker Compose.

---

## MVP North Star (Demo Narrative)

**"Support agent remembers preferences across sessions."**

**30–60s demo script:**

1. Create a project → configure provider (OpenAI/Anthropic) with API key
2. Send a few messages:
   - "I'm vegetarian."
   - "I prefer morning calls."
   - "I'm working on payments infra."
3. Search: "What are my preferences?" → returns concise facts + evidence
4. Open dashboard:
   - **Memories** list shows extracted facts with confidence + "evidence message"
   - **Knowledge graph** shows entities (User → Preference → Vegetarian), relations, and provenance
5. MCP: show an MCP client calling `memory.search` and getting a structured "context pack" for the agent

---

## Tech Stack (Locked)

### Monorepo
- **pnpm workspaces** (monorepo)
- **TypeScript** everywhere
- **Node.js v22.19.0** (specified in `.nvmrc` and `package.json` engines)

### Backend
- **Fastify** (HTTP API)
- **Prisma ORM**
- **Postgres + pgvector**
  - Prisma can work with Postgres extensions; vector types may require `Unsupported("vector")` patterns depending on your setup

### LLM + Embeddings
- **Vercel AI SDK** providers for embeddings + structured extraction from both OpenAI and Anthropic
- Default models: `gpt-4o-mini` for extraction, `text-embedding-3-small` for embeddings (configurable per project)

### Frontend Dashboard
- React + **TanStack Router**
- Graph visualization: **Cytoscape.js** or **Sigma.js**
  - Cytoscape is easiest to ship quickly; Sigma tends to look more "network graph" polished

### MCP Server
- MCP TypeScript SDK (`@modelcontextprotocol/sdk`) and expose tools only (add/search/graph)

### Code Quality
- **oxlint** for linting
- **oxfmt** for formatting
- **Vitest** for testing across monorepo

---

## Product Scope (MVP Constraints)

- **Single user** with multiple projects (no teams, no team → members, no team → projects)
- **Proper user registration/login** (email + password, session-based auth)
- Text only (messages) — no files
- Both raw + extracted facts ("memories") + knowledge graph
- Dashboard is **read-only** (no editing/deletion via UI)
- Keep infra simple at first (no queues/rate limits early); add later

---

## High-Level Architecture

**Monorepo packages:**

- `apps/api` — Fastify API server
- `apps/web` — React dashboard (TanStack Router)
- `apps/mcp` — MCP server
- `packages/shared` — zod schemas, types, utils
- `packages/llm` — Vercel AI SDK wrappers (embed/extract)
- `packages/db` — Prisma schema + migrations
- `packages/shared-config` — shared TSConfig, oxlint config

**Core flows:**

1. **Ingest** message → store raw message → extract facts/entities/relations → embed → store → consolidate
2. **Retrieve** memories for a query → vector search + rerank (similarity + recency) → return context pack
3. **Graph** view → fetch nodes/edges with evidence

---

## Data Model (Postgres via Prisma)

Schema supports auditability (where did this fact come from?), graph visualization, and solid retrieval.

### Tables

**Users**
- `User { id, email, passwordHash, createdAt, updatedAt }`

**Projects**
- `Project { id, userId, name, apiKey, provider, createdAt, updatedAt }`
  - `apiKey`: unique, auto-generated per project
  - `provider`: `"openai" | "anthropic"` (one provider per project)

**Provider Credentials (Global BYOK)**
- `ProviderKey { id, provider, encryptedKey, createdAt, updatedAt }`
  - Encrypt with app secret (`KEY_ENCRYPTION_SECRET`)
  - Global keys shared across projects (one per provider)

**Messages (Raw)**
- `Message { id, projectId, role, content, createdAt }`
  - `role`: `"user" | "assistant" | "system"`

**Memories (Structured)**
- `Memory { id, projectId, type, text, importance, confidence, status, createdAt, updatedAt, sourceMessageId }`
  - `type`: `"raw" | "fact" | "summary"`
  - `status`: `"active" | "superseded"` (for consolidation)
  - `importance`: `number` (0-1, optional hint from extraction)
  - `confidence`: `number` (0-1, from extraction)

**Embeddings**
- `MemoryEmbedding { memoryId, embedding }`
  - `embedding` as vector (Prisma `Unsupported("vector")` pattern)
  - One embedding per memory

**Entities (Graph Nodes)**
- `Entity { id, projectId, name, normalizedName, kind, createdAt }`
  - `kind`: open-ended string from model (e.g., "user", "preference", "topic", "project")
  - `normalizedName`: lowercase, trimmed for deduplication

**Relations (Graph Edges)**
- `Relation { id, projectId, subjectEntityId, predicate, objectEntityId, confidence, evidenceMemoryId, createdAt }`
  - `predicate`: open-ended string from model (e.g., "HAS_PREFERENCE", "WORKS_ON", "LIKES")
  - `evidenceMemoryId`: links back to the memory that created this relation

**Entity Mentions (Optional in MVP)**
- `EntityMention { entityId, memoryId }`
  - Tracks which memories mention which entities (useful for graph traversal)

### MVP Indexes

- Vector index on embeddings (HNSW recommended for pgvector)
- `projectId` compound indexes on all project-scoped tables
- Unique constraint on `(projectId, normalizedName, kind)` for entities
- Index on `(projectId, createdAt DESC)` for memories (for recency sorting)
- Index on `apiKey` for fast project lookup

---

## LLM Design

Two LLM tasks:

1. **Embedding** (for retrieval) — uses `text-embedding-3-small` by default
2. **Structured extraction** (facts + entities + relations) — uses `gpt-4o-mini` by default

### Extraction Output (Strict JSON)

Use `zod` schemas and reject/repair invalid output.

**Zod schema:**

```typescript
const ExtractionSchema = z.object({
  entities: z.array(z.object({
    name: z.string(),
    kind: z.string(), // open-ended
  })),
  facts: z.array(z.object({
    text: z.string(),
    confidence: z.number().min(0).max(1),
    importanceHint: z.number().min(0).max(1).optional(),
  })),
  relations: z.array(z.object({
    subject: z.string(), // entity name
    predicate: z.string(), // open-ended
    object: z.string(), // entity name
    confidence: z.number().min(0).max(1),
  })),
});
```

**Prompting strategy:**

- Extract stable user preferences / profile / constraints / session summaries that are useful later
- Avoid ephemeral details unless explicitly important
- If nothing should be remembered, return empty arrays
- Normalize entity names (lowercase, trim) for deduplication

**Failure handling:**

- If JSON is invalid: attempt repair (fix common issues like trailing commas, unclosed strings) + retry once
- If retry fails: log error, store raw message only, continue processing

**Model selection (post-MVP):**

- Router LLM call for model selection deferred to post-MVP
- Use sensible defaults: `gpt-4o-mini` for extraction, `text-embedding-3-small` for embeddings
- Allow per-project override in future

### Consolidation (MVP but Meaningful)

When a new fact is extracted:

1. Embed the new fact
2. Search existing `fact` memories (same project) with similarity threshold (e.g., 0.85)
3. If similarity > threshold:
   - **Newer fact overrides older**: mark old memory as `status: "superseded"`, create new memory as `status: "active"`
   - Update `updatedAt` timestamp
   - Preserve evidence chain (both memories link to their source messages)

This prevents memory spam and shows production thinking.

**Note on open enums:**

- `entity.kind` and `relation.predicate` are open-ended strings
- Con: harder to validate/normalize
- Mitigation: use `normalizedName` field + basic normalization (lowercase, trim) for deduplication
- Future: could add a "canonical predicates" mapping table for common patterns

---

## API Design (HTTP-only, Clean)

All endpoints are scoped by `projectId`.

### Authentication

**Dashboard (Web UI):**
- Email + password registration/login
- Session-based auth (cookies, no JWT)
- Same user credentials used for dashboard access

**API (for agents/integrations):**
- Project API keys via `X-API-Key` header
- One active API key per project
- Key is auto-generated on project creation

**MCP Server:**
- Uses project API key (stored server-side config) to call HTTP API

### Core Endpoints

**Auth (Dashboard)**
- `POST /v1/auth/register` — `{ email, password }`
- `POST /v1/auth/login` — `{ email, password }` → sets session cookie
- `POST /v1/auth/logout` — clears session
- `GET /v1/auth/me` — returns current user

**Projects**
- `POST /v1/projects` — `{ name, provider }` → creates project + API key
- `GET /v1/projects` — list user's projects (requires session)

**Provider Keys (Global)**
- `PUT /v1/admin/provider-keys` — `{ provider: "openai"|"anthropic", apiKey: "..." }` (admin-only, encrypted)
- `GET /v1/admin/provider-keys` — masked metadata only (admin-only)

**Ingestion**
- `POST /v1/projects/:projectId/messages` — `{ role, content }` (requires `X-API-Key`)
  - Response: `{ messageId, extracted: { factsCount, entitiesCount, relationsCount } }`

**Search**
- `POST /v1/projects/:projectId/memories/search` — `{ query, k, includeRaw?: boolean }` (requires `X-API-Key`)
  - Default: returns `fact` memories only
  - If `includeRaw: true`, includes `raw` memories in results
  - Response: `{ items: Memory[], contextPack: ContextPack }`

**Context Pack Structure:**

```typescript
interface ContextPack {
  profileFacts: string[]; // deduped facts grouped by entity
  preferences: Array<{ entity: string; fact: string; evidence: string }>;
  constraints: Array<{ entity: string; fact: string; evidence: string }>;
  summary: string; // brief narrative summary
  evidence: Array<{ memoryId: string; messageId: string; content: string }>;
}
```

**Ranking:**
- Sort primarily by similarity score (descending)
- Secondary sort by recency (`createdAt DESC`)
- Consider small recency boost: `finalScore = similarity * 0.9 + recencyBoost * 0.1` (optional enhancement)

**Read-only Dashboard Feeds**
- `GET /v1/projects/:projectId/memories?type=fact&cursor=...` (requires session)
- `GET /v1/projects/:projectId/graph?limit=...` (requires session)
- `GET /v1/projects/:projectId/graph/entity/:entityId` (requires session)

**Debug Endpoint**
- `GET /v1/projects/:projectId/memories/:memoryId/explain` (requires session)
  - Returns: similarity matches, evidence chain, extraction payload

---

## Dashboard Plan (Read-only, High Signal)

### Pages

1. **Login/Register**
2. **Project Switcher** (after login)
3. **Memory Explorer**
   - Filter by type (`fact`, `raw`, `summary`) / status
   - Show extracted facts with confidence + createdAt
   - Click → view evidence message + related graph edges
4. **Knowledge Graph**
   - Interactive graph (Cytoscape.js or Sigma.js)
   - Click node → side panel with:
     - Entity details
     - Outgoing/incoming relations
     - Evidence memories
5. **Search**
   - Search box calling `/memories/search`
   - Show results + "context pack preview" (what the agent would receive)

### UX Detail

Add an **"Evidence"** icon next to every fact and relation:
- Shows the raw message(s) that caused it
- Prevents "black-box memory" concerns

---

## MCP Server (Tools Only)

Use the TS SDK to expose a thin wrapper over your HTTP API.

### Tools

- `memory.add` → `{ projectId, role, content }` → calls `POST /messages`
- `memory.search` → `{ projectId, query, k }` → calls `POST /memories/search`
- `memory.graph` → `{ projectId, limit, cursor }` → calls `GET /graph`
- `memory.entity` → `{ projectId, entityId }` → calls `GET /graph/entity/:entityId`

### Output Formats

Return:
- `items[]` (memories)
- `contextPack` (structured JSON) with:
  - `profileFacts[]`
  - `preferences[]`
  - `constraints[]`
  - `evidence[]`

**Why MCP matters:** Shows understanding of interoperable tool APIs and how LLM agents plug into external memory providers. This is modern, standards-based integration.

---

## Security Choices (BYOK)

### MVP-safe Approach

- Store provider keys **encrypted at rest**
- Use one server-side master key (`KEY_ENCRYPTION_SECRET` env var)
- Never log raw keys
- Return only masked metadata in any API response (e.g., `sk-...****`)

**Encryption:**
- Use `crypto` module (Node.js built-in) with AES-256-GCM
- Store encrypted keys in `ProviderKey.encryptedKey`

**README note:**
- "Keys are encrypted at rest; rotate the master secret to re-encrypt."
- "For production, use KMS (AWS/GCP) or per-project envelope encryption."

---

## Observability & Testing

### Logging

**Structured JSON logs to stdout:**
- Use a logger like `pino` (Fastify's default) or `winston` with JSON formatter
- Log:
  - API requests: `{ method, path, statusCode, latency, projectId }`
  - LLM calls: `{ provider, model, task, latency, tokenCount, success }`
  - Extraction failures: `{ messageId, error, repairAttempted }`
  - Consolidation events: `{ newMemoryId, supersededMemoryId, similarity }`

### Metrics (Post-MVP)

- `/metrics` endpoint (Prometheus format) for:
  - Request rate, latency (p50, p95, p99)
  - LLM call rate, latency, error rate
  - Memory extraction rate, consolidation rate

### Testing Strategy

**Vitest across monorepo:**

1. **Unit tests:**
   - Extraction zod validation + repair logic
   - Consolidation similarity threshold logic
   - Entity normalization utilities

2. **Integration tests:**
   - API endpoints (Fastify + test DB)
   - Auth flow (register → login → project creation)
   - Search + ranking logic

3. **End-to-end tests:**
   - Happy path: "I'm vegetarian" → fact extraction → search → context pack
   - Consolidation: duplicate fact → supersedes old
   - Graph: entities + relations → graph API → dashboard render

**Test DB:**
- Use separate Postgres instance for tests (via `docker compose -f docker-compose.test.yml`)
- Or use `pg-mem` for faster unit tests (optional)

---

## Dev Workflow & Tooling

### Package Manager & Scripts

**Top-level `package.json` scripts:**

```json
{
  "scripts": {
    "dev": "pnpm --parallel --filter './apps/*' dev",
    "build": "pnpm --recursive build",
    "lint": "oxlint .",
    "lint:fix": "oxlint . --fix",
    "fmt": "oxfmt .",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "db:migrate": "pnpm --filter packages/db migrate",
    "db:studio": "pnpm --filter packages/db studio"
  }
}
```

**Per-app scripts:**
- `apps/api`: `dev` → `tsx watch src/index.ts`
- `apps/web`: `dev` → `vite` (or TanStack Start)
- `apps/mcp`: `dev` → `tsx watch src/index.ts`

### Pre-commit Hooks

Use `lint-staged` + `husky`:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["oxlint --fix", "oxfmt"]
  }
}
```

### Shared Config

**`packages/shared-config`:**
- `tsconfig.base.json` — base TSConfig extended by all packages
- `oxlint.config.js` — shared oxlint rules
- Each app/package extends base config

### Docker & Local Dev

**Development:**
- Only Postgres runs in Docker (`docker compose up postgres`)
- API + Web run via `pnpm dev` (outside Docker)
- Env vars: `.env.local` (gitignored) for local dev

**Production:**
- Full `docker-compose.yml` with API + Web + Postgres
- Separate compose file for production deployment

**Node version:**
- `.nvmrc`: `22.19.0`
- `package.json` engines: `"node": ">=22.19.0"`

---

## Checkpoints (Staged Build)

### Stage 1 — Repo + DB Foundation

**Deliver:**
- pnpm monorepo scaffolding
- Shared config package (`packages/shared-config`)
- Prisma schema + migrations
- Fastify server boots
- Health check endpoint
- Docker Compose for Postgres (dev only)

**Accept:**
- `docker compose up postgres` brings up Postgres cleanly
- `pnpm dev` starts API server
- Health check returns `{ status: "ok" }`

### Stage 2 — Auth + Projects + API Keys

**Deliver:**
- User registration/login (email + password, session cookies)
- Create/list projects
- Project API key auto-generation + storage
- Auth middleware for dashboard (session) and API (`X-API-Key`)

**Accept:**
- Can register → login → create project
- Dashboard shows projects list
- `curl` with `X-API-Key` works for API endpoints

### Stage 3 — Message Ingestion (Raw Only)

**Deliver:**
- `POST /messages` stores messages
- Memory Explorer shows raw timeline
- Dashboard lists messages per project

**Accept:**
- Dashboard lists messages per project
- Messages persist and show in UI

### Stage 4 — Embeddings + Semantic Search

**Deliver:**
- Vercel AI SDK embedding wrapper (`packages/llm`)
- Store embeddings in pgvector
- `/memories/search` returns relevant raw messages
- Ranking: similarity + recency

**Accept:**
- Queries work without keyword overlap (semantic match)
- Results sorted by similarity then recency

### Stage 5 — Fact Extraction (Structured Memories)

**Deliver:**
- Extract facts/entities/relations via LLM → validate with zod
- Store `fact` memories with evidence link
- Repair + retry logic for invalid JSON
- Open-ended `kind` and `predicate` fields

**Accept:**
- Enter "I'm vegetarian" → a fact memory appears with evidence
- Invalid JSON is repaired or logged gracefully

### Stage 6 — Knowledge Graph Generation

**Deliver:**
- Entities + relations persisted
- Graph API endpoint returns nodes/edges
- Graph page renders + side panel evidence
- Entity normalization (lowercase, trim)

**Accept:**
- Graph meaningfully links entities and relations
- Clicking shows provenance (evidence messages)

### Stage 7 — Consolidation + Quality Improvements

**Deliver:**
- Similarity-based dedupe for facts (newer overrides older)
- Mark old memories as `superseded`
- "Explain" endpoint for a memory
- Context pack generation (deduped preferences, grouped by entity)

**Accept:**
- Repeating same preference doesn't spam duplicates
- Explain shows similarity matches and evidence chain
- Context pack is structured and useful for agents

### Stage 8 — MCP Server (Tools Only)

**Deliver:**
- MCP server with `memory.add/search/graph/entity`
- Works against your HTTP API (uses project API key)
- Returns context pack format

**Accept:**
- MCP client can call `memory.search` and get a context pack
- Tools are discoverable and well-documented

### Stage 9 — Testing + OSS Polish

**Deliver:**
- Unit tests (extraction, consolidation)
- Integration tests (API endpoints)
- E2E test (happy path scenario)
- Excellent README + architecture diagram
- Demo script + sample curl commands
- "Design decisions" doc (tradeoffs, future roadmap)
- 2–3 min screen-recorded demo

**Accept:**
- Test suite passes
- A stranger can run it locally and reproduce your demo reliably
- README explains self-hosting (like Supabase/Listmonk)

---

## What to Emphasize in README

1. **Why Postgres-only** (fewer moving parts, still supports vectors + graph tables)
2. **Evidence-first memory** (facts always link back to raw messages)
3. **Strict JSON extraction** (zod validation, retries/repair)
4. **Context pack** output (agent-ready, structured)
5. **MCP integration** (interoperability, modern tooling standards)
6. **Self-hostable** (easy VPS deployment, Docker Compose, similar to Supabase/Listmonk)
7. **Open-ended graph** (no rigid schemas, LLM-driven extraction)

---

## Next Steps (Implementation Order)

1. Scaffold monorepo + shared config + Prisma + Postgres compose
2. Implement auth (register/login) + projects + API keys
3. Implement message ingest + raw timeline dashboard
4. Add embeddings + semantic search
5. Add extraction + graph + consolidation
6. Add MCP server
7. Add tests + polish

---

## References

- [Prisma Postgres Extensions](https://www.prisma.io/docs/postgres/database/postgres-extensions)
- [Vercel AI SDK Providers](https://ai-sdk.dev/providers/ai-sdk-providers/openai)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Fastify JWT](https://github.com/fastify/fastify-jwt)
