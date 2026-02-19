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
- **Knowledge Graph** — Entities, relations, and their source evidence
- **Automatic Consolidation** — Similar facts are deduplicated; superseded memories stay linked for traceability
- **Explain Endpoint** — Full provenance per memory: source message, entity mentions, consolidation history
- **Evidence-First Design** — Every memory traces back to its originating message
- **Self-Hostable** — Deploy with Docker Compose; bring your own OpenAI key
- **Dashboard** — Prisma Studio available locally; full dashboard UI planned in Phase 4
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
# Edit .env.local — fill in OPENAI_API_KEY (DATABASE_URL is pre-filled for Docker)

# Start PostgreSQL (with pgvector)
pnpm db:up

# Run migrations
pnpm db:migrate

# Seed test data (creates a test project)
pnpm db:seed

# Build workspace packages, then start the API server
pnpm dev
```

The API will be available at `http://localhost:3000`.

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

> **Tip**: Run `pnpm db:studio` to browse your data visually in Prisma Studio at `http://localhost:5555`.

### Try It Out

```bash
# Use the project ID printed by the seed script
PROJECT_ID="<your-project-id>"

# 1. Ingest messages — triggers background extraction + embedding
curl -X POST "http://localhost:3000/v1/projects/${PROJECT_ID}/messages" \
  -H "Content-Type: application/json" \
  -d '{"role": "user", "content": "I am vegetarian and I love cooking Italian food"}'

curl -X POST "http://localhost:3000/v1/projects/${PROJECT_ID}/messages" \
  -H "Content-Type: application/json" \
  -d '{"role": "user", "content": "I follow a plant-based diet"}'

# Wait ~5 seconds for background LLM processing, then search
# Returns items + a contextPack ready to inject into an LLM prompt
curl -X POST "http://localhost:3000/v1/projects/${PROJECT_ID}/memories/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "dietary preferences", "k": 5}'

# Explore the knowledge graph
curl "http://localhost:3000/v1/projects/${PROJECT_ID}/graph"

# Inspect a specific fact — shows source message + consolidation history
MEMORY_ID="<a-memory-id-from-search>"
curl "http://localhost:3000/v1/projects/${PROJECT_ID}/memories/${MEMORY_ID}/explain"
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

### Upcoming Phases

- **Phase 3**: Auth + Projects + Provider Keys (session auth, API key middleware, encrypted key storage)
- **Phase 4**: Dashboard UI (React + TanStack Router + knowledge graph visualization)
- **Phase 5**: MCP Server (`memory.add`, `memory.search`, `memory.graph` tools)
- **Phase 6**: Testing + OSS Polish (unit + integration + e2e tests, CI/CD, docs)

See [`dev-plans/plan.md`](./dev-plans/plan.md) for detailed progress tracking.

## Architecture

### Monorepo Structure

```
memo-mesh/
├── apps/
│   ├── api/           # Fastify HTTP API (all core endpoints)
│   ├── web/           # React dashboard (Phase 4)
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
- **LLM**: Vercel AI SDK — `text-embedding-3-small` (1536-dim embeddings), `gpt-4o-mini` (structured extraction)
- **Validation**: Zod schemas shared across all packages
- **Code Quality**: oxlint, oxfmt, Vitest
- **Package Manager**: pnpm workspaces

### Core Data Flow

```
POST /messages
  → Store Message + raw Memory (Prisma transaction)
  → [async] Embed raw memory → pgvector
  → [async] extractKnowledge (gpt-4o-mini)
      → Upsert Entities
      → Create fact Memories
      → Embed fact → pgvector
      → Find similar active facts (cosine similarity > 0.70)
          → Supersede duplicates (consolidation)
      → Create EntityMentions + Relations

POST /memories/search
  → Embed query → pgvector similarity search
  → Rank: finalScore = similarity×0.9 + recency×0.1
  → Build contextPack (group facts by entity, unattached facts)
  → Return { items, contextPack }

GET /memories/:id/explain
  → Fetch memory + source message + entity mentions
  → Find similar memories across all statuses (consolidation history)
  → Return full provenance
```

## API Reference

All endpoints are currently unauthenticated — `projectId` is passed in the URL. Auth middleware is coming in Phase 3.

```
GET  /health

# Message ingestion
POST /v1/projects/:projectId/messages

# Semantic search + context pack
POST /v1/projects/:projectId/memories/search

# Knowledge graph
GET  /v1/projects/:projectId/graph
GET  /v1/projects/:projectId/graph/entity/:entityId

# Memory provenance
GET  /v1/projects/:projectId/memories/:memoryId/explain
```

## Development

### Available Scripts

```bash
# Development
pnpm dev              # Build packages, then start API server (tsx watch)
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

# LLM — required for embeddings + fact extraction
OPENAI_API_KEY=sk-your-key-here

# Seed options (optional)
SEED_LOG_SECRETS=false   # Set to "true" to print the API key in plaintext
SEED_API_KEY=mm_abc123   # Override the generated API key (useful for dev)
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

**Status**: Phase 2 complete ✅ — Core pipeline fully operational. Next: Phase 3 (Auth + Projects).
