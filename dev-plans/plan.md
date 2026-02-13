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

### 2E — Knowledge Graph Endpoints

- [ ] Implement `GET /v1/projects/:projectId/graph` endpoint
  - Return `{ nodes: Entity[], edges: Relation[] }`
  - Include evidence memory IDs in edges
  - Support `limit` query param
- [ ] Implement `GET /v1/projects/:projectId/graph/entity/:entityId` endpoint
  - Return entity details + outgoing/incoming relations + evidence memories

**2E Acceptance**: Graph API returns meaningful nodes/edges. Entity endpoint shows relations with provenance.

### 2F — Consolidation

- [ ] Implement similarity threshold check (e.g., 0.85)
- [ ] On new fact extraction: embed → search existing `active` facts in same project
- [ ] If similarity > threshold: mark old as `status: "superseded"`, create new as `status: "active"`
- [ ] Preserve evidence chain (both memories link to their source messages)
- [ ] Update `updatedAt` timestamp on superseded memory

**2F Acceptance**: Repeating "I'm vegetarian" and "I follow a vegetarian diet" doesn't create duplicates — old fact is superseded.

### 2G — Context Pack + Explain

- [ ] Implement context pack builder utility (`packages/shared` or `apps/api`)
  - Dedupe preferences by entity
  - Group facts by entity
  - Generate brief narrative summary
  - Include evidence messages
  - Return structured `ContextPack` format
- [ ] Update `/memories/search` to return `{ items, contextPack }` response
- [ ] Implement `GET /v1/projects/:projectId/memories/:memoryId/explain` endpoint
  - Return similarity matches, evidence chain, extraction payload
  - Return consolidation history if applicable

**2G Acceptance**: Search returns structured context pack. Explain endpoint shows full provenance and reasoning.

---

## Phase 3 — Auth + Projects + Provider Keys

> **Strategy**: Now wrap the working core with proper auth, project management, and encrypted key storage.

### User Authentication

- [ ] Add password hashing utility (bcrypt or similar)
- [ ] Implement `POST /v1/auth/register` (email + password)
- [ ] Implement `POST /v1/auth/login` (email + password → session cookie)
- [ ] Implement `POST /v1/auth/logout` (clears session)
- [ ] Implement `GET /v1/auth/me` (returns current user)
- [ ] Add session middleware (HttpOnly cookies, no JWT)
- [ ] Add password validation (min length, etc.)

### Projects Management

- [ ] Implement `POST /v1/projects` (creates project + auto-generates API key)
- [ ] Implement `GET /v1/projects` (list user's projects, requires session)
- [ ] Add project API key generation (crypto.randomBytes or similar)
- [ ] Store API key in `Project.apiKey` field

### Provider Keys (Global)

- [ ] Implement encryption utility (`crypto` AES-256-GCM)
- [ ] Implement `PUT /v1/admin/provider-keys` (encrypts and stores key)
- [ ] Implement `GET /v1/admin/provider-keys` (returns masked metadata)
- [ ] Update `packages/llm` to read provider keys from DB (decrypt) instead of env vars

### Auth Middleware

- [ ] Add session auth middleware for dashboard routes
- [ ] Add `X-API-Key` auth middleware for API routes (messages, search)
- [ ] Add project lookup by API key
- [ ] Add project ownership validation
- [ ] Wire middleware into all existing core endpoints

**Phase 3 Acceptance**: Can register → login → create project → use API key for ingestion/search. Provider keys encrypted in DB.

---

## Phase 4 — Dashboard UI

> **Strategy**: Build the read-only dashboard now that all API endpoints exist and are authenticated.

### Web App Setup

- [ ] Set up `apps/web` with React + TanStack Router + TanStack Query
- [ ] Add login/register pages
- [ ] Add project switcher

### Memory Explorer Page

- [ ] Implement `GET /v1/projects/:projectId/memories?type=fact&cursor=...` endpoint (if not done)
- [ ] Create Memory Explorer page
- [ ] Filter by type (`fact`, `raw`) and status (`active`, `superseded`)
- [ ] Show facts with confidence + createdAt
- [ ] Click → view evidence message + related graph edges
- [ ] Add "Evidence" icon next to every fact

### Knowledge Graph Page

- [ ] Install graph visualization library (Cytoscape.js or Sigma.js)
- [ ] Create Knowledge Graph page
- [ ] Fetch graph data from API
- [ ] Render interactive graph
- [ ] Click node → side panel with entity details, relations, evidence memories

### Search Page

- [ ] Create Search page
- [ ] Add search input calling `/memories/search`
- [ ] Display search results
- [ ] Show "context pack preview" (what the agent would receive)
- [ ] Format context pack nicely (preferences, constraints, evidence)

**Phase 4 Acceptance**: Dashboard shows memories, graph, and search. Evidence is visible everywhere. All pages work with real authenticated data.

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

- Current phase: Phase 2E (Knowledge Graph Endpoints)
- Phase 1: ✅ Complete
- Phase 2: 🟡 In progress (2A ✅ | 2B ✅ | 2C ✅ | 2D ✅ | 2E–2G ⬜)
- Phase 3: ⬜ Not started
- Phase 4: ⬜ Not started
- Phase 5: ⬜ Not started
- Phase 6: ⬜ Not started

---

**Note**: Mark checkboxes as you complete them. This plan is a living document—update it as needed!
