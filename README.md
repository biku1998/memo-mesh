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
- **Self-hostable**: Deploy on your own infrastructure with full control over data and costs
- **MCP integration**: Standard Model Context Protocol support for seamless agent integration

Designed for developers who want control, transparency, and evidence-based memory systems.

## Features

- **Semantic Memory Search** — Vector-based retrieval with similarity + recency ranking
- **Structured Extraction** — LLM-powered fact extraction with Zod validation (gpt-4o-mini)
- **Knowledge Graph** — Entities, relations, and their provenance
- **Evidence-First Design** — Every memory traces back to source messages
- **Self-Hostable** — Deploy on your VPS with Docker Compose
- **BYOK (Bring Your Own Keys)** — Use your own OpenAI API keys
- **MCP Support** — Model Context Protocol integration (planned)
- **Dashboard** — Explore memories and graph relationships (planned)

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
# Edit .env.local — set your OPENAI_API_KEY

# Start PostgreSQL (with pgvector)
pnpm db:up

# Run migrations
pnpm db:migrate

# Seed test data (creates a test project with a known API key)
pnpm db:seed

# Start the API server
pnpm dev
```

The API will be available at `http://localhost:3000`.

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

### Try It Out

```bash
# Use the project ID from seed output
PROJECT_ID="<your-project-id>"

# Ingest a message (triggers fact extraction + embedding in the background)
curl -X POST "http://localhost:3000/v1/projects/${PROJECT_ID}/messages" \
  -H "Content-Type: application/json" \
  -d '{"role": "user", "content": "I am vegetarian and I love cooking Italian food"}'

# Wait a few seconds for background processing, then search semantically
curl -X POST "http://localhost:3000/v1/projects/${PROJECT_ID}/memories/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "What are their dietary preferences?", "k": 5}'
```

The search will return extracted facts like "user is vegetarian" ranked by semantic similarity — no keyword overlap needed.

## Current Progress

**Approach**: Core-first — build the differentiating memory pipeline first (ingest -> embed -> extract -> search -> graph -> consolidate), then add standard infrastructure (auth, dashboard, MCP).

### Phase 1: Repo + DB Foundation — Complete

- pnpm monorepo with workspace configuration
- Prisma 7 schema with all core models (User, Project, Message, Memory, Entity, Relation)
- PostgreSQL 16 + pgvector with Docker Compose
- Fastify API server with health check

### Phase 2: Core Pipeline — In Progress

| Sub-phase | Status | Description |
|-----------|--------|-------------|
| 2A | Done | Seed script + message ingestion endpoint |
| 2B | Done | Embeddings via `text-embedding-3-small` (1536-dim, pgvector) |
| 2C | Done | Semantic search (cosine distance + recency ranking) |
| 2D | Done | Fact extraction (gpt-4o-mini structured output -> entities, facts, relations) |
| 2E | Next | Knowledge graph endpoints |
| 2F | Planned | Consolidation (dedup similar facts) |
| 2G | Planned | Context pack + explain endpoints |

### Upcoming Phases

- **Phase 3**: Auth + Projects + Provider Keys
- **Phase 4**: Dashboard UI (React + TanStack)
- **Phase 5**: MCP Server
- **Phase 6**: Testing + OSS Polish

See [`dev-plans/plan.md`](./dev-plans/plan.md) for detailed progress tracking.

## Architecture

### Monorepo Structure

```
memo-mesh/
├── apps/
│   ├── api/           # Fastify HTTP API server
│   ├── web/           # React dashboard (planned)
│   └── mcp/           # MCP server (planned)
├── packages/
│   ├── db/            # Prisma schema, migrations, pgvector helpers
│   ├── llm/           # Vercel AI SDK wrappers (embeddings + extraction)
│   ├── shared/        # Zod schemas, types, utilities
│   └── shared-config/ # Shared TSConfig, oxlint config
└── docker-compose.dev.yml
```

### Tech Stack

- **Runtime**: Node.js 22.19.0, TypeScript 5.9
- **Backend**: Fastify, Prisma 7 (driver adapter pattern), PostgreSQL 16 + pgvector
- **LLM**: Vercel AI SDK — `text-embedding-3-small` (embeddings), `gpt-4o-mini` (extraction)
- **Validation**: Zod schemas shared across packages
- **Code Quality**: oxlint, oxfmt, Vitest
- **Package Manager**: pnpm workspaces

### Core Flows

1. **Ingest**: Message -> Store raw memory -> Extract facts/entities/relations (LLM) -> Embed all memories -> Store in pgvector
2. **Retrieve**: Query -> Embed query -> Vector similarity search -> Rank by `similarity * 0.9 + recency * 0.1` -> Return results
3. **Graph**: Entities + relations with evidence chain -> Trace back to source messages

## Development

### Available Scripts

```bash
# Development
pnpm dev              # Start API server in dev mode (tsx watch)
pnpm build            # Build all packages

# Database
pnpm db:up            # Start PostgreSQL (Docker)
pnpm db:down          # Stop PostgreSQL
pnpm db:migrate       # Run Prisma migrations
pnpm db:studio        # Open Prisma Studio (browse data at localhost:5555)
pnpm db:seed          # Seed test user + project

# Code Quality
pnpm lint             # Lint all code
pnpm fmt              # Format all code
pnpm test             # Run all tests
```

### Environment Variables

Create a `.env.local` file at the repo root:

```bash
# Database
DATABASE_URL=postgresql://memo:memo@localhost:5432/memo_mesh

# LLM (required for embeddings + extraction)
OPENAI_API_KEY=sk-your-key-here
```

### API Endpoints (implemented)

```
GET    /health                                    # Health check
POST   /v1/projects/:id/messages                  # Ingest message (+ extract + embed)
POST   /v1/projects/:id/memories/search           # Semantic search
```

Auth is not yet implemented — endpoints currently require `projectId` in the URL directly.

### Project Conventions

- See [`AGENTS.md`](./AGENTS.md) for development conventions
- See [`dev-plans/plan.md`](./dev-plans/plan.md) for implementation plan
- See [`dev-plans/mvp-plan-final.md`](./dev-plans/mvp-plan-final.md) for detailed specifications

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Resources

- [Development Plan](./dev-plans/plan.md) - Implementation checklist
- [MVP Specifications](./dev-plans/mvp-plan-final.md) - Detailed specs
- [Vercel AI SDK](https://ai-sdk.dev/)
- [pgvector](https://github.com/pgvector/pgvector)
- [MCP Specification](https://modelcontextprotocol.io/)

---

**Status**: Phase 2 In Progress — Core pipeline (2A-2D complete, 2E-2G remaining)
