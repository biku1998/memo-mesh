# Implementation Plan

A self-hostable memory layer for LLM agents. This plan tracks progress with a **core-first** approach — build the differentiating pipeline first, then add standard infrastructure around it.

**Reference**: See `dev-plans/mvp-plan-final.md` for detailed specifications.

**Approach**: Build the core memory pipeline (ingest → embed → extract → graph → consolidate → search) first using a seeded test project and env vars for LLM keys. Then circle back for auth, dashboard UI, MCP, and polish.

---

## Phase 1 — Repo + DB Foundation ✅

### Monorepo Setup

- [x] Initialize pnpm workspace with `pnpm-workspace.yaml`
- [x] Create package structure:
  - [x] `apps/api`
  - [x] `apps/web`
  - [x] `apps/mcp`
  - [x] `packages/shared`
  - [x] `packages/llm`
  - [x] `packages/db`
  - [x] `packages/shared-config`
- [x] Set up root `package.json` with scripts (dev, build, lint, fmt, test)
- [x] Configure Node.js v22.19.0 (`.nvmrc` + `package.json` engines)

### Shared Config

- [x] Create `packages/shared-config` package
- [x] Add `tsconfig.base.json` (base TypeScript config)
- [x] Add `oxlint.config.js` (shared lint rules)
- [x] Each app/package extends base config (API configured, others will be configured as created)

### Database Setup

- [x] Create `packages/db` package
- [x] Initialize Prisma schema (`prisma/schema.prisma`)
- [x] Define all tables:
  - [x] `User`
  - [x] `Project`
  - [x] `ProviderKey`
  - [x] `Message`
  - [x] `Memory`
  - [x] `MemoryEmbedding`
  - [x] `Entity`
  - [x] `Relation`
  - [x] `EntityMention`
- [x] Add indexes (vector, projectId, apiKey, createdAt)
- [x] Create initial migration (with pgvector extension and vector index)
- [x] Set up Docker Compose for Postgres (`docker-compose.dev.yml` with pgvector image)
- [x] Add DB scripts to root (`db:up`, `db:down`, `db:migrate`, `db:studio`)

### API Server Foundation

- [x] Create `apps/api` package
- [x] Set up Fastify server
- [x] Add health check endpoint (`GET /health`)
- [x] Configure structured logging (Fastify's built-in pino logger)
- [x] Test: `docker compose up postgres` brings up Postgres cleanly ✅
- [x] Test: `pnpm dev` starts API server ✅
- [x] Test: Health check returns `{ status: "ok" }` ✅

**Phase 1 Acceptance**: ✅ All completed. Health check works, Postgres runs in Docker.

---

## Phase 2 — Core Pipeline (the differentiating part)

> **Strategy**: Use a seed script to create a test project. Use `OPENAI_API_KEY` env var directly for LLM calls (skip encrypted ProviderKey table for now). All endpoints temporarily skip auth — just require `projectId` in the URL.

### 2A — Seed Script + Message Ingestion ✅

- [x] Create a seed script (`packages/db/prisma/seed.ts`) that creates a test user + project
- [x] Add `db:seed` script to root `package.json`
- [x] Implement `POST /v1/projects/:projectId/messages` endpoint
- [x] Validate request body (`role`, `content`) with Zod
- [x] Store message in `Message` table
- [x] Create a raw `Memory` record (type: `raw`) linked to the message
- [x] Return `{ messageId }` response
- [x] Set up `packages/db` with Prisma 7 driver adapter (`@prisma/adapter-pg`)
- [x] Set up `packages/shared` with Zod schemas (`CreateMessageBody`, `CreateMessageResponse`)
- [x] Wire workspace packages into `apps/api` (source `.ts` exports for tsx dev mode)
- [x] Update Prisma generator to `prisma-client` with local output (`src/generated/prisma`)

**2A Acceptance**: ✅ Seed creates test project, POST stores message + raw memory, validation rejects invalid input.

### 2B — LLM Package + Embeddings ✅

- [x] Set up `packages/llm` package (Vercel AI SDK + `@ai-sdk/openai`)
- [x] Create embedding wrapper functions (`generateEmbedding`, `generateEmbeddings` in `packages/llm`)
- [x] Use `OPENAI_API_KEY` from env vars directly (no DB lookup yet)
- [x] Default model: `text-embedding-3-small` (1536 dimensions)
- [x] Add error handling for embedding calls (fire-and-forget with fastify error logging)
- [x] On message ingestion: generate embedding for the raw memory
- [x] Store embedding in `MemoryEmbedding` table via raw SQL (`$executeRawUnsafe` with pgvector cast)
- [x] Add `storeMemoryEmbedding` helper in `packages/db` (raw SQL for `Unsupported("vector")` column)

**2B Acceptance**: ✅ Messages get embedded on ingestion. Embeddings stored in pgvector (verified 1536-dim vectors).

### 2C — Semantic Search ✅

- [x] Implement `POST /v1/projects/:projectId/memories/search` endpoint
- [x] Validate request body (`query`, `k`, `includeRaw`) with Zod (`SearchMemoriesBody` schema)
- [x] Generate query embedding using `packages/llm`
- [x] Perform vector similarity search (pgvector cosine distance via `searchMemoriesByVector`)
- [x] Implement ranking: `finalScore = similarity * 0.9 + recencyBoost * 0.1` (exponential decay, 7-day half-life)
- [x] Return results sorted by final score
- [x] Return `{ items }` response with `memoryId`, `text`, `type`, `similarity`, `recencyBoost`, `finalScore`, `createdAt`
- [x] Add Zod schemas in `packages/shared` (`SearchMemoriesBody`, `SearchMemoryItem`, `SearchMemoriesResponse`)

**2C Acceptance**: ✅ Queries work without keyword overlap (semantic match). "sports" → basketball, "pet" → dog, "programming" → TypeScript. Results sorted by finalScore.

### 2D — Fact Extraction ✅

- [x] Create Zod schema for extraction output (`packages/shared/src/schemas/extraction.ts`)
  - `ExtractionResult` with `entities[]`, `facts[]`, `relations[]`
  - `ExtractedFact` with confidence (0-1), optional importance
  - `ExtractedRelation` with subject/predicate/object + confidence
- [x] Create extraction wrapper function (`extractKnowledge` in `packages/llm`)
- [x] Design extraction prompt (stable preferences/profile/constraints, entity types, relations)
- [x] Default model: `gpt-4o-mini` via Vercel AI SDK `generateObject`
- [x] Call LLM with structured output → Zod schema validation (handled by AI SDK)
- [x] Implement entity normalization utility (`normalizeEntityName` in `packages/shared/src/utils/`)
- [x] Wire into ingestion pipeline (fire-and-forget):
  - On message POST → extract facts/entities/relations via `extractKnowledge`
  - Store facts as `Memory` records (type: `fact`, with confidence + importance)
  - Store entities in `Entity` table (upsert by `normalizedName` + `kind`)
  - Store relations in `Relation` table (with `evidenceMemoryId`)
  - Generate embeddings for fact memories (1536-dim)
  - Store fact embeddings in `MemoryEmbedding`
  - Create `EntityMention` records linking facts to entities

**2D Acceptance**: ✅ POST "I am vegetarian" → fact memory "user is vegetarian" (confidence: 0.9), entities (user, Italian food, Google, Python), relations (works at, uses). Facts searchable by semantic similarity. Errors logged gracefully.

### 2E — Knowledge Graph Endpoints ✅

- [x] Implement `GET /v1/projects/:projectId/graph` endpoint
  - Returns `{ nodes: Entity[], edges: Relation[] }`
  - Includes evidence memory IDs in edges
  - Supports `limit` query param (default 100, max 500)
  - Zod validation for params + query
- [x] Implement `GET /v1/projects/:projectId/graph/entity/:entityId` endpoint
  - Returns entity details + outgoing/incoming relations + evidence memories
  - Includes `mentions` array (entity mentions linked to fact memories)
  - Validates entity belongs to project

**2E Acceptance**: ✅ Graph API returns nodes (user, Google, Python, Italian food) and edges (works at, team uses) with evidence. Entity detail shows incoming/outgoing relations with provenance.

### 2F — Consolidation ✅

- [x] Implement similarity threshold check (0.70 cosine similarity)
- [x] On new fact extraction: embed → search existing `active` facts in same project
- [x] If similarity > threshold: mark old as `status: "superseded"`, create new as `status: "active"`
- [x] Preserve evidence chain (both memories link to their source messages)
- [x] Update `updatedAt` timestamp on superseded memory
- [x] Add `findSimilarActiveFacts` and `supersedeMemory` helpers in `packages/db/src/embeddings.ts`
- [x] Changed fact embedding from fire-and-forget to `await` (needed for consolidation query)

**2F Acceptance**: ✅ "I eat only plant-based food" → new fact active, old "user follows a vegetarian diet" superseded. Evidence chain preserved.

### 2G — Context Pack + Explain ✅

- [x] Define `ContextPack`, `ContextPackEntity`, `ContextPackFact` Zod schemas in `packages/shared`
- [x] Add `MemoryParams` Zod schema (projectId + memoryId) for param validation
- [x] Add `getMemoriesWithEntityMentions` DB helper to fetch entity mentions per memory
- [x] Add `getMemoryWithProvenance` DB helper (memory + source message + entity mentions)
- [x] Add `findSimilarMemoriesByMemoryId` DB helper (cross-status vector search via subquery)
- [x] Implement context pack builder (`buildContextPack`) in search route
  - Groups facts by entity using entity mention joins
  - Unlinked facts go in `unattachedFacts`
  - Generates brief narrative summary
  - Includes `evidenceMessageId` per fact
- [x] Update `/memories/search` to return `{ items, contextPack }`
- [x] Implement `GET /v1/projects/:projectId/memories/:memoryId/explain` endpoint
  - Returns memory details, source message, entity mentions, similar memories
  - Similar memories include superseded facts (consolidation history)
- [x] Fix extraction prompt to instruct LLM to populate `fact.entities` field

**2G Acceptance**: ✅ Search returns contextPack with facts grouped by entity (user, TypeScript). Explain endpoint shows full provenance (source message, entity mentions) and consolidation history (superseded "user works at Stripe" visible as similar memory).

---

## Phase 3 — Auth + Projects + Provider Keys

> **Strategy**: Split into two sub-phases. 3A delivers the minimal auth gate needed to unlock the Playground (Phase 4). 3B adds encrypted provider key management — not required for the playground since `OPENAI_API_KEY` env var still works in dev.

### 3A — Minimal Auth Gate (prerequisite for Playground)

#### User Authentication

- [x] Add password hashing utility (`bcryptjs`)
- [x] Implement `POST /v1/auth/register` (email + password)
- [x] Implement `POST /v1/auth/login` (email + password → HttpOnly session cookie)
- [x] Implement `POST /v1/auth/logout` (clears session)
- [x] Implement `GET /v1/auth/me` (returns current user)
- [x] Add session middleware (HttpOnly cookies, no JWT; `@fastify/cookie` + `@fastify/session`)
- [x] Add password validation (min 8 chars)

#### Projects Management

- [x] Implement `POST /v1/projects` — `{ name, provider }` → creates project + auto-generates API key
- [x] Implement `GET /v1/projects` — list user's projects (requires session)
- [x] Add project API key generation (`crypto.randomBytes(24).toString("hex")` → `mm_` prefix)
- [x] Store API key plaintext in `Project.apiKey` field

#### Auth Middleware

- [x] Add session auth middleware for dashboard/web routes (verifies session cookie)
- [x] Add `X-API-Key` middleware for agent-facing routes (`/messages`, `/memories/search`, `/graph`, `/memories/:id/explain`)
- [x] Add project lookup by API key + project ownership validation (cross-project access blocked)
- [x] Wire middleware into all existing core endpoints via scoped Fastify plugin + preHandler hook
- [x] Configure CORS (`@fastify/cors`) for web dev server origin (`WEB_ORIGIN` env var)
- [x] Update `.env.example` with `SESSION_SECRET`, `OPENAI_API_KEY`, `WEB_ORIGIN`

**3A Acceptance**: ✅ Can register → login → create project → see project list. Existing core endpoints now require `X-API-Key`. Ready to build the Playground.

---

### 3B — Provider Key Management (after Playground validation)

- [ ] Implement encryption utility (`crypto` AES-256-GCM, keyed by `KEY_ENCRYPTION_SECRET` env var)
- [ ] Implement `PUT /v1/admin/provider-keys` — encrypts and stores provider API key
- [ ] Implement `GET /v1/admin/provider-keys` — returns masked metadata only
- [ ] Update `packages/llm` to read provider keys from DB (decrypt) instead of env vars
- [ ] Document key rotation process in README

**3B Acceptance**: Provider keys encrypted at rest. `packages/llm` reads from DB, not env vars. Never logs raw keys.

---

## Phase 4 — Playground + Dashboard

> **Strategy**: Build the Playground workbench first as the production-quality frontend (no throwaway code — uses TanStack Router + TanStack Query from day one). Validate the full core pipeline end-to-end in the UI before adding graph visualization and the full explorer.

### 4A — Web App Setup ✅

- [x] Initialize `apps/web` with Vite + React + TypeScript
- [x] Add TanStack Router (programmatic route tree)
- [x] Add TanStack Query (API data fetching + caching)
- [x] Add Tailwind CSS v4 (`@tailwindcss/vite` plugin)
- [x] Add API client utility (`src/lib/api.ts` — typed fetch wrapper)
- [x] Set up `apps/web` dev script (`vite`) + included in `pnpm dev`
- [x] Add `typecheck` scripts to `apps/api`, `apps/web`, and root

#### Auth Pages ✅

- [x] Login page (`/login`) — email + password → calls `POST /v1/auth/login`
- [x] Register page (`/register`) — calls `POST /v1/auth/register`
- [x] Protected route wrapper (`beforeLoad` → `getMe()` → redirect to `/login` if unauthenticated)
- [x] Project list page (`/projects`) — calls `GET /v1/projects`, link to select a project

### 4B — Workbench Page (Playground core) ✅

> Route: `/projects/:projectId/workbench`

**Layout**: Split-panel — left 40% ingest + extracted results, right 60% search + context pack.

#### Left panel — Ingest ✅

- [x] Message input (textarea + role selector: user / assistant / system)
- [x] Send button → calls `POST /messages` with project's API key
- [x] After send: show "Extracting…" spinner, then **auto-poll** search every 2s for up to 15s
- [x] Once facts appear (or polling timeout): render extracted facts list with confidence badges
- [x] Show message history (recent messages sent this session)

#### Right panel — Search + Context Pack ✅

- [x] Search input → calls `POST /memories/search` on submit
- [x] Results list: ranked items with similarity score, recency boost, final score
- [x] Context pack section below results:
  - Summary line (e.g., "Found 5 facts across 2 entities")
  - Facts grouped by entity (collapsible per entity)
  - Unattached facts section
- [x] Each fact row: click to open the Explain drawer (4C)

**4B Acceptance**: Send "I am vegetarian" → facts appear in left panel within ~5s. Search "diet" → returns ranked results with contextPack grouping. Full pipeline visible in a single screen.

### 4C — Explain Drawer ✅

> Slide-in panel triggered by clicking any fact (in left panel or search results)

- [x] Calls `GET /memories/:memoryId/explain`
- [x] Shows: memory text, type, status (active / superseded badge), confidence
- [x] Shows: source message (evidence) — role + full content + timestamp
- [x] Shows: entity mentions (entity name + kind chips)
- [x] Shows: similar memories list (with status badges — active/superseded) — consolidation history
- [x] Keyboard shortcut to close (`Esc`)
- [x] Backdrop click to close

**4C Acceptance**: Click any fact → drawer slides in showing its source message and consolidation history. Evidence loop is closed.

---

> ### Playground Acceptance Gate
>
> Before building 4D/4E, validate the full pipeline end-to-end in the UI:
>
> - [x] Send 3-4 diverse messages → facts, entities, relations extracted and visible
> - [x] Duplicate message sent → old fact shows as superseded in explain drawer
> - [x] Search returns semantically relevant results with context pack
> - [x] Explain drawer shows correct source message + entity mentions
> - [x] Core pipeline is "nailed" ✅ — proceed to graph + explorer

---

### 4D — Knowledge Graph Page

> Route: `/projects/:projectId/graph`

- [ ] Install graph visualization library (Cytoscape.js recommended for quick ship)
- [ ] Fetch graph data from `GET /graph`
- [ ] Render interactive graph: entity nodes + relation edges
- [ ] Click node → right side panel with entity details, outgoing/incoming relations, evidence memories
- [ ] Color-code nodes by entity `kind` (person, organization, product, etc.)
- [ ] Edge labels show relation predicate

### 4E — Memory Explorer Page

> Route: `/projects/:projectId/memories`

- [ ] Implement `GET /v1/projects/:projectId/memories?type=fact&status=active&cursor=...` API endpoint
- [ ] Paginated list of memories (cursor-based)
- [ ] Filter by type (`fact`, `raw`) and status (`active`, `superseded`)
- [ ] Show facts with confidence + createdAt
- [ ] Click row → opens Explain drawer (reuse 4C component)
- [ ] "Evidence" icon on every fact row

**Phase 4 Acceptance**: Full dashboard working — workbench, explain, graph, memory explorer. All data authenticated. Evidence visible everywhere.

---

## Phase 5 — MCP Server

### MCP Server Setup

- [ ] Set up `apps/mcp` package with MCP TypeScript SDK (`@modelcontextprotocol/sdk`)
- [ ] Configure project API key (server-side config)

### MCP Tools

- [ ] Implement `memory.add` tool → calls `POST /v1/projects/:projectId/messages`
- [ ] Implement `memory.search` tool → calls `POST /v1/projects/:projectId/memories/search`
- [ ] Implement `memory.graph` tool → calls `GET /v1/projects/:projectId/graph`
- [ ] Implement `memory.entity` tool → calls `GET /v1/projects/:projectId/graph/entity/:entityId`
- [ ] Return context pack format in search tool response
- [ ] Add tool descriptions and parameter schemas

### MCP Testing

- [ ] Test with MCP client
- [ ] Verify tools are discoverable and return correct formats

**Phase 5 Acceptance**: MCP client can call `memory.search` and get a context pack. All tools work.

---

## Phase 6 — Testing + OSS Polish

### Unit Tests

- [ ] Test extraction zod validation logic
- [ ] Test repair logic for invalid JSON
- [ ] Test consolidation similarity threshold logic
- [ ] Test entity normalization utilities
- [ ] Test context pack generation
- [ ] Test encryption/decryption utilities

### Integration Tests

- [ ] Test API endpoints (Fastify + test DB)
- [ ] Test auth flow (register → login → project creation)
- [ ] Test search + ranking logic
- [ ] Test message ingestion → extraction → storage flow
- [ ] Test graph API endpoints

### End-to-End Tests

- [ ] Happy path: "I'm vegetarian" → fact extraction → search → context pack
- [ ] Consolidation: duplicate fact → supersedes old
- [ ] Graph: entities + relations → graph API
- [ ] MCP: client calls tools → gets context pack

### Documentation

- [ ] Write README.md (self-hosting, quick start, architecture, API docs, MCP docs)
- [ ] Create architecture diagram
- [ ] Write demo script + sample curl commands
- [ ] Create "Design decisions" doc (tradeoffs, future roadmap)
- [ ] Document environment variables (`.env.example`)

### CI/CD + Hooks

- [ ] Set up GitHub Actions workflow (typecheck, lint, fmt:check, test)
  - [ ] Start Postgres service container in CI (with pgvector image)
  - [ ] Run `prisma migrate deploy` (or `prisma migrate dev`) before the test step; provide `DATABASE_URL` secret
  - [ ] Run test step only after migrations succeed
- [ ] Set up Husky + lint-staged (oxlint --fix + oxfmt on staged files)
- [ ] Cache pnpm dependencies in CI

### Demo

- [ ] Record 2–3 min screen-recorded demo
- [ ] Show: create project → send messages → search → dashboard → graph → MCP

**Phase 6 Acceptance**: Test suite passes. A stranger can run it locally and reproduce the demo reliably.

---

## Quick Reference

### Key Commands

- `pnpm dev` - Start all apps in dev mode
- `pnpm build` - Build all packages
- `pnpm lint` - Lint all code
- `pnpm fmt` - Format all code
- `pnpm test` - Run all tests
- `pnpm db:up` - Start Postgres (Docker)
- `pnpm db:down` - Stop Postgres
- `pnpm db:migrate` - Run Prisma migrations
- `pnpm db:studio` - Open Prisma Studio
- `pnpm db:seed` - Seed test data

### Key Files

- `dev-plans/mvp-plan-final.md` - Detailed specifications
- `AGENTS.md` - Development conventions
- `CLAUDE.md` - Quick reference
- `packages/db/prisma/schema.prisma` - Database schema
- `.env.example` - Environment variables template

### Progress Tracking

- Current phase: Phase 4 — 4D Knowledge Graph
- Phase 1: ✅ Complete
- Phase 2: ✅ Complete (2A ✅ | 2B ✅ | 2C ✅ | 2D ✅ | 2E ✅ | 2F ✅ | 2G ✅)
- Phase 3: ✅ Complete (3A ✅ | 3B ✅)
- Phase 4: 🔄 In progress (4A ✅ | 4B ✅ | 4C ✅ | Playground Gate ✅ | 4D ⬜ | 4E ⬜)
- Phase 5: ⬜ Not started
- Phase 6: ⬜ Not started

---

**Note**: Mark checkboxes as you complete them. This plan is a living document—update it as needed!
