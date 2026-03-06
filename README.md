# Memo Mesh

> A self-hostable memory layer for LLM agents. Enable your agents to remember user preferences, constraints, and context across sessions through structured fact extraction, semantic search, and a knowledge graph.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.19-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.28-orange.svg)](https://pnpm.io/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Motivation

Modern LLM agents often struggle with **persistent memory** — they forget user preferences, constraints, and context between sessions. Memo Mesh solves this by providing:

- **Evidence-first memory**: Every extracted fact links back to its source message, ensuring full auditability
- **Semantic search**: Find relevant memories using vector similarity, not just keyword matching
- **Knowledge graph**: Relationships between entities, preferences, and constraints
- **Consolidation**: Duplicate or updated facts are automatically superseded rather than duplicated
- **Context packs**: Search results are structured so an LLM agent can consume them directly
- **Self-hostable**: Deploy on your own infrastructure with full control over data and costs
- **MCP integration**: Standard Model Context Protocol support for seamless agent integration (coming in Phase 5)

Designed for developers who want control, transparency, and evidence-based memory systems.

## Features

- **Semantic Memory Search** — Vector-based retrieval with similarity + recency ranking; returns a structured `contextPack` ready for agent consumption
- **Structured Fact Extraction** — LLM-powered extraction with Zod validation (`gpt-4o-mini`)
- **Knowledge Graph** — Interactive graph visualization with entities, relations, and source evidence
- **Automatic Consolidation** — Similar facts are deduplicated; superseded memories stay linked for traceability
- **Explain Endpoint** — Full provenance per memory: source message, entity mentions, consolidation history
- **Evidence-First Design** — Every memory traces back to its originating message
- **Self-Hostable** — Deploy with Docker Compose; bring your own OpenAI key
- **Dashboard** — Full web UI with workbench (ingest + search), knowledge graph, settings, and explain drawer
- **Auth** — Email/password registration, session-based auth, per-project API keys
- **Provider Key Management** — Encrypted BYOK storage (AES-256-GCM) for OpenAI/Anthropic keys
- **MCP Support** — Planned in Phase 5

## Quick Start

### Prerequisites

- Node.js 22.19.0+ (use [nvm](https://github.com/nvm-sh/nvm) with `.nvmrc`)
- pnpm 10.28+
- Docker & Docker Compose
- An OpenAI API key (for embeddings + extraction)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd memo-mesh

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local — fill in OPENAI_API_KEY, SESSION_SECRET, KEY_ENCRYPTION_SECRET

# Start PostgreSQL (with pgvector)
pnpm db:up

# Run migrations
pnpm db:migrate

# Seed test data (creates a test user + project)
pnpm db:seed

# Start all apps (API + Web dashboard)
pnpm dev
```

The API will be available at `http://localhost:3000` and the web dashboard at `http://localhost:5173`.

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

> **Tip**: Run `pnpm db:studio` to browse your data visually in Prisma Studio at `http://localhost:5555`.

### Try It Out

#### Via the Web Dashboard

1. Open `http://localhost:5173` and register an account
2. Create a project from the Projects page
3. Open the Workbench — send messages, search memories, and view extracted facts
4. Explore the Knowledge Graph to see entities and relations
5. Visit Settings to configure your provider API keys

#### Via the API

```bash
# 1. Login and get a session cookie
curl -c cookies.txt -X POST "http://localhost:3000/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "your-password"}'

# 2. List your projects
curl -b cookies.txt "http://localhost:3000/v1/projects"

# 3. Get the project's API key
curl -b cookies.txt "http://localhost:3000/v1/projects/<PROJECT_ID>/api-key"

# 4. Ingest messages (uses X-API-Key header)
API_KEY="mm_your-api-key"

curl -X POST "http://localhost:3000/v1/projects/<PROJECT_ID>/messages" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"role": "user", "content": "I am vegetarian and I love cooking Italian food"}'

curl -X POST "http://localhost:3000/v1/projects/<PROJECT_ID>/messages" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"role": "user", "content": "I follow a plant-based diet"}'

# 5. Wait ~5 seconds for background LLM processing, then search
curl -X POST "http://localhost:3000/v1/projects/<PROJECT_ID>/memories/search" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"query": "dietary preferences", "k": 5}'

# 6. Explore the knowledge graph (uses session cookie)
curl -b cookies.txt "http://localhost:3000/v1/projects/<PROJECT_ID>/graph"

# 7. Inspect a specific fact's provenance
curl -b cookies.txt "http://localhost:3000/v1/projects/<PROJECT_ID>/memories/<MEMORY_ID>/explain"
```

The search returns extracted facts like "user is vegetarian" ranked by semantic similarity with a `contextPack` grouping facts by entity — no keyword overlap needed. When you send the plant-based diet message, the similar vegetarian fact is automatically superseded (consolidation).

## Current Progress

**Approach**: Core-first — build the differentiating memory pipeline first (ingest → embed → extract → search → graph → consolidate → context pack), then add standard infrastructure (auth, dashboard, MCP).

### Phase 1: Repo + DB Foundation — Complete ✅

- pnpm monorepo with workspace configuration
- Prisma 7 schema with all core models (`User`, `Project`, `Message`, `Memory`, `MemoryEmbedding`, `Entity`, `Relation`, `EntityMention`)
- PostgreSQL 16 + pgvector with Docker Compose
- Fastify API server with health check

### Phase 2: Core Pipeline — Complete ✅

| Sub-phase | Status | Description |
|-----------|--------|-------------|
| 2A | ✅ | Seed script + `POST /messages` endpoint (stores message + raw memory atomically) |
| 2B | ✅ | Embeddings via `text-embedding-3-small` (1536-dim, pgvector) |
| 2C | ✅ | Semantic search (cosine similarity + recency ranking) |
| 2D | ✅ | Fact extraction (`gpt-4o-mini` structured output → entities, facts, relations) |
| 2E | ✅ | Knowledge graph endpoints (`GET /graph`, `GET /graph/entity/:id`) |
| 2F | ✅ | Consolidation — similar facts auto-superseded (threshold: 0.70 cosine similarity) |
| 2G | ✅ | Context pack + explain — search returns grouped `contextPack`; `/explain` shows full provenance |

### Phase 3: Auth + Projects + Provider Keys — Complete ✅

- Email/password registration and login with session cookies (no JWT)
- Project creation with auto-generated API keys (`mm_` prefix)
- Session auth middleware for dashboard routes, `X-API-Key` middleware for agent-facing routes
- Encrypted provider key storage (AES-256-GCM) with masked metadata API
- CORS configuration for web dev server

### Phase 4: Dashboard UI — In Progress 🔄

| Sub-phase | Status | Description |
|-----------|--------|-------------|
| 4A | ✅ | Web app setup (Vite + React + TanStack Router/Query + Tailwind CSS v4) |
| 4B | ✅ | Workbench page — message ingest + search + context pack viewer |
| 4C | ✅ | Explain drawer — full provenance, consolidation history, entity mentions |
| 4D | ✅ | Settings page — provider key management UI |
| 4E | ✅ | Knowledge graph page — interactive Cytoscape.js visualization with entity side panel |
| 4F | ⬜ | Memory explorer page — paginated list with filters and explain integration |

### Upcoming Phases

- **Phase 5**: MCP Server (`memory.add`, `memory.search`, `memory.graph`, `memory.entity` tools)
- **Phase 6**: Testing + OSS Polish (unit + integration + e2e tests, CI/CD, docs)

See [`dev-plans/plan.md`](./dev-plans/plan.md) for detailed progress tracking.

## Architecture

### Monorepo Structure

```text
memo-mesh/
├── apps/
│   ├── api/           # Fastify HTTP API (all core endpoints)
│   ├── web/           # React dashboard (Vite + TanStack Router)
│   └── mcp/           # MCP server (Phase 5)
├── packages/
│   ├── db/            # Prisma schema, migrations, pgvector helpers
│   ├── llm/           # Vercel AI SDK wrappers (embeddings + extraction)
│   ├── shared/        # Zod schemas, types, utilities
│   └── shared-config/ # Shared TSConfig, oxlint config
└── docker-compose.dev.yml
```

### Tech Stack

- **Runtime**: Node.js 22.19.0, TypeScript 5.9
- **Backend**: Fastify 5, Prisma 7 (driver adapter pattern), PostgreSQL 16 + pgvector
- **Frontend**: React 19, Vite, TanStack Router + Query, Tailwind CSS v4, Shadcn UI (radix-lyra), Cytoscape.js
- **LLM**: Vercel AI SDK — `text-embedding-3-small` (1536-dim embeddings), `gpt-4o-mini` (structured extraction)
- **Auth**: Session-based (HttpOnly cookies), per-project API keys
- **Validation**: Zod schemas shared across all packages
- **Code Quality**: oxlint, oxfmt, Vitest
- **Package Manager**: pnpm workspaces

### Core Data Flow

```
POST /messages (X-API-Key auth)
  → Store Message + raw Memory (Prisma transaction)
  → [async] Embed raw memory → pgvector
  → [async] extractKnowledge (gpt-4o-mini)
      → Upsert Entities
      → Create fact Memories
      → Embed fact → pgvector
      → Find similar active facts (cosine similarity > 0.70)
          → Supersede duplicates (consolidation)
      → Create EntityMentions + Relations

POST /memories/search (X-API-Key auth)
  → Embed query → pgvector similarity search
  → Rank: finalScore = similarity×0.9 + recency×0.1
  → Build contextPack (group facts by entity, unattached facts)
  → Return { items, contextPack }

GET /memories/:id/explain (session auth)
  → Fetch memory + source message + entity mentions
  → Find similar memories across all statuses (consolidation history)
  → Return full provenance
```

## API Reference

### Authentication

- **Dashboard routes**: Session-based auth via HttpOnly cookies (register → login → session)
- **Agent-facing routes**: Per-project API key via `X-API-Key` header

### Endpoints

```http
# Health
GET  /health

# Auth (session cookies)
POST /v1/auth/register          # { email, password }
POST /v1/auth/login             # { email, password } → sets session cookie
POST /v1/auth/logout            # clears session
GET  /v1/auth/me                # returns current user

# Projects (session auth)
POST /v1/projects               # { name, provider }
GET  /v1/projects               # list user's projects
GET  /v1/projects/:id/api-key   # get project API key

# Provider Keys (session auth)
PUT  /v1/admin/provider-keys    # { provider, apiKey } → encrypted storage
GET  /v1/admin/provider-keys    # masked metadata only
DELETE /v1/admin/provider-keys/:provider

# Message ingestion (X-API-Key auth)
POST /v1/projects/:projectId/messages

# Semantic search + context pack (X-API-Key auth)
POST /v1/projects/:projectId/memories/search

# Knowledge graph (session auth)
GET  /v1/projects/:projectId/graph
GET  /v1/projects/:projectId/graph/entity/:entityId

# Memory provenance (session auth)
GET  /v1/projects/:projectId/memories/:memoryId/explain
```

## Development

### Available Scripts

```bash
# Development
pnpm dev              # Start API server + web dashboard
pnpm build            # Build all packages

# Database
pnpm db:up            # Start PostgreSQL (Docker)
pnpm db:down          # Stop PostgreSQL
pnpm db:migrate       # Run Prisma migrations
pnpm db:studio        # Open Prisma Studio at localhost:5555
pnpm db:seed          # Seed test user + project

# Code Quality
pnpm lint             # Lint all code (oxlint)
pnpm fmt              # Format all code (oxfmt)
pnpm test             # Run all tests (Vitest)
pnpm typecheck        # Type-check all packages
```

### Environment Variables

Create `.env.local` at the repo root:

```bash
# Database (matches Docker Compose defaults)
DATABASE_URL=postgresql://memo:memo@localhost:5432/memo_mesh
POSTGRES_USER=memo
POSTGRES_PASSWORD=memo
POSTGRES_DB=memo_mesh
POSTGRES_PORT=5432

# LLM — used as fallback when no key is stored in the DB via PUT /v1/admin/provider-keys
OPENAI_API_KEY=sk-your-key-here

# Auth — change both secrets before deploying to production
SESSION_SECRET=change-me-before-deploying-to-production
# Used to encrypt provider API keys at rest (AES-256-GCM)
KEY_ENCRYPTION_SECRET=change-me-before-deploying-to-production

# Web dev server origin (used for CORS)
WEB_ORIGIN=http://localhost:5173

# Seed options (optional)
SEED_LOG_SECRETS=false
SEED_API_KEY=
```

### Project Conventions

- See [`AGENTS.md`](./AGENTS.md) for development conventions (branch names, commit style, CI)
- See [`dev-plans/plan.md`](./dev-plans/plan.md) for the implementation checklist
- See [`dev-plans/mvp-plan-final.md`](./dev-plans/mvp-plan-final.md) for detailed specifications

## License

MIT License — see [LICENSE](LICENSE) file for details.

## Resources

- [Development Plan](./dev-plans/plan.md) — Implementation checklist
- [MVP Specifications](./dev-plans/mvp-plan-final.md) — Detailed specs
- [Vercel AI SDK](https://ai-sdk.dev/)
- [pgvector](https://github.com/pgvector/pgvector)
- [Prisma](https://www.prisma.io/)
- [MCP Specification](https://modelcontextprotocol.io/)

---

**Status**: Phase 4 in progress 🔄 — Dashboard mostly complete (workbench, graph, settings, explain). Next: Memory Explorer (4F), then MCP Server (Phase 5).
