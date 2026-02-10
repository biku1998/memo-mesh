# Implementation Plan

A self-hostable memory layer for LLM agents. This plan tracks progress through 9 stages with actionable checkpoints.

**Reference**: See `dev-plans/mvp-plan-final.md` for detailed specifications.

---

## Stage 1 — Repo + DB Foundation

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
- [x] Test: Health check returns `{ status: "ok" }` ✅ (server starts successfully)

**Stage 1 Acceptance**: ✅ All checkboxes above completed, health check works, Postgres runs in Docker.

---

## Stage 2 — Auth + Projects + API Keys

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
- [ ] Add admin middleware (check if user is admin/owner)

### Auth Middleware

- [ ] Add session auth middleware for dashboard routes
- [ ] Add `X-API-Key` auth middleware for API routes
- [ ] Add project lookup by API key
- [ ] Add project ownership validation

**Stage 2 Acceptance**: Can register → login → create project. Dashboard shows projects list. `curl` with `X-API-Key` works for API endpoints.

---

## Stage 3 — Message Ingestion (Raw Only)

### Message Storage

- [ ] Implement `POST /v1/projects/:projectId/messages` endpoint
- [ ] Validate request body (role, content) with Zod
- [ ] Store message in `Message` table
- [ ] Return `{ messageId }` response

### Dashboard - Memory Explorer (Raw Timeline)

- [ ] Create `apps/web` package
- [ ] Set up TanStack Router
- [ ] Set up TanStack Query
- [ ] Create Memory Explorer page
- [ ] Implement `GET /v1/projects/:projectId/memories?type=raw` endpoint
- [ ] Display raw messages timeline in dashboard
- [ ] Add project switcher UI

**Stage 3 Acceptance**: Dashboard lists messages per project. Messages persist and show in UI.

---

## Stage 4 — Embeddings + Semantic Search

### LLM Package Setup

- [ ] Create `packages/llm` package
- [ ] Install Vercel AI SDK
- [ ] Create embedding wrapper function
- [ ] Support OpenAI (`text-embedding-3-small`) and Anthropic
- [ ] Add provider key retrieval (decrypt from `ProviderKey` table)
- [ ] Add error handling for LLM calls

### Embedding Storage

- [ ] Create `MemoryEmbedding` table (if not already done)
- [ ] Generate embedding for each message on ingestion
- [ ] Store embedding in pgvector (using `Unsupported("vector")` pattern)
- [ ] Create vector index (HNSW recommended)

### Semantic Search

- [ ] Implement `POST /v1/projects/:projectId/memories/search` endpoint
- [ ] Generate query embedding
- [ ] Perform vector similarity search (pgvector)
- [ ] Implement ranking: similarity score + recency boost
- [ ] Return results sorted by final score
- [ ] Support `includeRaw` query param (default: facts only)

**Stage 4 Acceptance**: Queries work without keyword overlap (semantic match). Results sorted by similarity then recency.

---

## Stage 5 — Fact Extraction (Structured Memories)

### Extraction Schema

- [ ] Create Zod schema for extraction output (`packages/shared`)
- [ ] Define `ExtractionSchema` with entities, facts, relations
- [ ] Add validation for confidence scores (0-1)
- [ ] Add validation for optional `importanceHint`

### LLM Extraction

- [ ] Create extraction wrapper function (`packages/llm`)
- [ ] Design extraction prompt (preferences/profile/constraints/session summaries)
- [ ] Call LLM with structured output (OpenAI/Anthropic)
- [ ] Parse and validate JSON response with Zod
- [ ] Implement repair logic (fix common JSON errors)
- [ ] Implement retry once on failure
- [ ] Log extraction failures gracefully

### Memory Storage

- [ ] Store extracted facts as `Memory` records (type: `fact`)
- [ ] Store entities in `Entity` table (with `normalizedName`)
- [ ] Store relations in `Relation` table
- [ ] Link memories to source messages (`sourceMessageId`)
- [ ] Generate embeddings for fact memories
- [ ] Store embeddings in `MemoryEmbedding` table

### Entity Normalization

- [ ] Implement normalization utility (lowercase, trim)
- [ ] Store `normalizedName` for deduplication
- [ ] Handle open-ended `kind` and `predicate` fields

**Stage 5 Acceptance**: Enter "I'm vegetarian" → a fact memory appears with evidence. Invalid JSON is repaired or logged gracefully.

---

## Stage 6 — Knowledge Graph Generation

### Graph Data Model

- [ ] Ensure `Entity` and `Relation` tables are properly indexed
- [ ] Add unique constraint on `(projectId, normalizedName, kind)` for entities
- [ ] Link relations to evidence memories (`evidenceMemoryId`)

### Graph API Endpoints

- [ ] Implement `GET /v1/projects/:projectId/graph` endpoint
- [ ] Return nodes (entities) and edges (relations)
- [ ] Include evidence memory IDs in response
- [ ] Implement `GET /v1/projects/:projectId/graph/entity/:entityId` endpoint
- [ ] Return entity details + outgoing/incoming relations + evidence

### Dashboard - Knowledge Graph Page

- [ ] Install graph visualization library (Cytoscape.js or Sigma.js)
- [ ] Create Knowledge Graph page
- [ ] Fetch graph data from API
- [ ] Render interactive graph
- [ ] Add click handler for nodes
- [ ] Create side panel component
- [ ] Show entity details in side panel
- [ ] Show outgoing/incoming relations
- [ ] Show evidence memories (link to source messages)

**Stage 6 Acceptance**: Graph meaningfully links entities and relations. Clicking shows provenance (evidence messages).

---

## Stage 7 — Consolidation + Quality Improvements

### Consolidation Logic

- [ ] Implement similarity threshold check (e.g., 0.85)
- [ ] On new fact extraction: search existing facts
- [ ] If similarity > threshold: mark old as `superseded`, create new as `active`
- [ ] Preserve evidence chain (both memories link to source messages)
- [ ] Update `updatedAt` timestamp

### Context Pack Generation

- [ ] Implement context pack builder utility
- [ ] Dedupe preferences by entity
- [ ] Group facts by entity
- [ ] Generate brief narrative summary
- [ ] Include evidence messages
- [ ] Return structured `ContextPack` format
- [ ] Update search endpoint to return `contextPack` in response

### Explain Endpoint

- [ ] Implement `GET /v1/projects/:projectId/memories/:memoryId/explain` endpoint
- [ ] Return similarity matches
- [ ] Return evidence chain
- [ ] Return extraction payload
- [ ] Return consolidation history (if applicable)

### Dashboard - Search Page

- [ ] Create Search page in dashboard
- [ ] Add search input calling `/memories/search`
- [ ] Display search results
- [ ] Show "context pack preview" component
- [ ] Format context pack nicely (preferences, constraints, evidence)

**Stage 7 Acceptance**: Repeating same preference doesn't spam duplicates. Explain shows similarity matches and evidence chain. Context pack is structured and useful for agents.

---

## Stage 8 — MCP Server (Tools Only)

### MCP Server Setup

- [ ] Create `apps/mcp` package
- [ ] Install MCP TypeScript SDK (`@modelcontextprotocol/sdk`)
- [ ] Set up MCP server structure
- [ ] Configure project API key storage (server-side config)

### MCP Tools Implementation

- [ ] Implement `memory.add` tool → calls `POST /v1/projects/:projectId/messages`
- [ ] Implement `memory.search` tool → calls `POST /v1/projects/:projectId/memories/search`
- [ ] Implement `memory.graph` tool → calls `GET /v1/projects/:projectId/graph`
- [ ] Implement `memory.entity` tool → calls `GET /v1/projects/:projectId/graph/entity/:entityId`
- [ ] Return context pack format in search tool response
- [ ] Add tool descriptions and parameter schemas

### MCP Testing

- [ ] Test MCP server with MCP client
- [ ] Verify `memory.search` returns context pack
- [ ] Verify all tools are discoverable
- [ ] Document MCP server usage in README

**Stage 8 Acceptance**: MCP client can call `memory.search` and get a context pack. Tools are discoverable and well-documented.

---

## Stage 9 — Testing + OSS Polish

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

- [ ] Test happy path: "I'm vegetarian" → fact extraction → search → context pack
- [ ] Test consolidation: duplicate fact → supersedes old
- [ ] Test graph: entities + relations → graph API → dashboard render
- [ ] Test MCP: client calls tools → gets context pack

### Documentation

- [ ] Write excellent README.md
  - [ ] Self-hosting instructions (like Supabase/Listmonk)
  - [ ] Quick start guide
  - [ ] Architecture overview
  - [ ] API documentation
  - [ ] MCP server documentation
- [ ] Create architecture diagram
- [ ] Write demo script (step-by-step)
- [ ] Add sample curl commands
- [ ] Create "Design decisions" doc (tradeoffs, future roadmap)
- [ ] Document environment variables (`.env.example`)

### Demo

- [ ] Record 2–3 min screen-recorded demo
- [ ] Show: create project → send messages → search → dashboard → graph → MCP
- [ ] Upload demo video (or link in README)

### CI/CD

- [ ] Set up GitHub Actions workflow
- [ ] Run `pnpm typecheck` in CI
- [ ] Run `pnpm lint` in CI
- [ ] Run `pnpm fmt:check` in CI
- [ ] Run `pnpm test` in CI
- [ ] Run Prisma migrations in CI
- [ ] Cache pnpm dependencies

### Pre-commit Hooks

- [ ] Set up Husky
- [ ] Configure lint-staged
- [ ] Run `oxlint --fix` and `oxfmt` on staged files

**Stage 9 Acceptance**: Test suite passes. A stranger can run it locally and reproduce your demo reliably. README explains self-hosting clearly.

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

### Key Files

- `dev-plans/mvp-plan-final.md` - Detailed specifications
- `AGENTS.md` - Development conventions
- `CLAUDE.md` - Quick reference
- `packages/db/prisma/schema.prisma` - Database schema
- `.env.example` - Environment variables template

### Progress Tracking

- Total checkboxes: ~150+
- Current stage: Stage 1
- Last updated: [Update this date as you progress]

---

**Note**: Mark checkboxes as you complete them. This plan is a living document—update it as needed!
