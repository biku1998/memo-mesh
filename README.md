# Memo Mesh

> A self-hostable memory layer for LLM agents. Enable your agents to remember user preferences, constraints, and context across sessions through structured fact extraction, semantic search, and a knowledge graph.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.19-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.28-orange.svg)](https://pnpm.io/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 Motivation

Modern LLM agents often struggle with **persistent memory**—they forget user preferences, constraints, and context between sessions. Memo Mesh solves this by providing:

- **Evidence-first memory**: Every extracted fact links back to its source message, ensuring full auditability
- **Semantic search**: Find relevant memories using vector similarity, not just keyword matching
- **Knowledge graph**: Visualize relationships between entities, preferences, and constraints
- **Self-hostable**: Deploy on your own infrastructure with full control over data and costs
- **MCP integration**: Standard Model Context Protocol support for seamless agent integration

Think of it as a self-hostable alternative to Supermemory or Mem0, designed for developers who want control, transparency, and evidence-based memory systems.

## ✨ Features

- 🔍 **Semantic Memory Search** - Vector-based retrieval with similarity ranking
- 📊 **Knowledge Graph** - Visualize entities, relations, and their provenance
- 🔐 **Evidence-First Design** - Every memory traces back to source messages
- 🔒 **Self-Hostable** - Deploy on your VPS with Docker Compose
- 🛠️ **MCP Support** - Standard Model Context Protocol integration
- 🎨 **Read-Only Dashboard** - Explore memories and graph relationships
- 🔑 **BYOK (Bring Your Own Keys)** - Use your own OpenAI/Anthropic API keys
- 📦 **Structured Extraction** - LLM-powered fact extraction with Zod validation

## 🚀 Quick Start

### Prerequisites

- Node.js 22.19.0+ (use [nvm](https://github.com/nvm-sh/nvm) with `.nvmrc`)
- pnpm 10.28+
- Docker & Docker Compose
- PostgreSQL 16+ (via Docker)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd memo-mesh

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL if needed

# Start PostgreSQL
pnpm db:up

# Run migrations
pnpm db:migrate

# Start development servers
pnpm dev
```

The API will be available at `http://localhost:3000`. Test the health endpoint:

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

## 📊 Current Progress

### ✅ Stage 1: Repo + DB Foundation (Complete)

- [x] pnpm monorepo setup with workspace configuration
- [x] Prisma schema with all core models (User, Project, Message, Memory, Entity, Relation)
- [x] PostgreSQL + pgvector setup with Docker Compose
- [x] Fastify API server with health check endpoint
- [x] Structured logging and TypeScript configuration

### 🚧 Stage 2: Auth + Projects + API Keys (In Progress)

- [ ] User registration/login with session-based auth
- [ ] Project management with auto-generated API keys
- [ ] Provider key encryption (BYOK support)
- [ ] Authentication middleware (session + API key)

### 📋 Upcoming Stages

- **Stage 3**: Message ingestion (raw timeline)
- **Stage 4**: Embeddings + semantic search
- **Stage 5**: Fact extraction (structured memories)
- **Stage 6**: Knowledge graph generation
- **Stage 7**: Consolidation + quality improvements
- **Stage 8**: MCP server integration
- **Stage 9**: Testing + OSS polish

See [`dev-plans/plan.md`](./dev-plans/plan.md) for detailed progress tracking.

## 🏗️ Architecture

### Monorepo Structure

```
memo-mesh/
├── apps/
│   ├── api/          # Fastify HTTP API server
│   ├── web/          # React dashboard (TanStack Router)
│   └── mcp/          # MCP server for agent integration
├── packages/
│   ├── db/           # Prisma schema + migrations
│   ├── llm/          # Vercel AI SDK wrappers (embeddings + extraction)
│   ├── shared/       # Zod schemas, types, utilities
│   └── shared-config/ # Shared TSConfig, oxlint config
└── docker-compose.dev.yml
```

### Tech Stack

- **Runtime**: Node.js 22.19.0, TypeScript 5.9
- **Backend**: Fastify, Prisma ORM, PostgreSQL 16 + pgvector
- **LLM**: Vercel AI SDK (OpenAI, Anthropic)
- **Frontend**: React, TanStack Router, TanStack Query
- **Graph**: Cytoscape.js or Sigma.js
- **Code Quality**: oxlint, oxfmt, Vitest
- **Package Manager**: pnpm workspaces

### Core Flows

1. **Ingest**: Message → Store raw → Extract facts/entities/relations → Embed → Store → Consolidate
2. **Retrieve**: Query → Vector search → Rerank (similarity + recency) → Return context pack
3. **Graph**: Fetch nodes/edges → Visualize relationships → Show evidence

## 🔧 Development

### Available Scripts

```bash
# Development
pnpm dev              # Start all apps in dev mode
pnpm build            # Build all packages
pnpm lint             # Lint all code
pnpm fmt              # Format all code
pnpm test             # Run all tests

# Database
pnpm db:up            # Start PostgreSQL (Docker)
pnpm db:down          # Stop PostgreSQL
pnpm db:migrate       # Run Prisma migrations
pnpm db:studio        # Open Prisma Studio
```

### Environment Variables

Create a `.env` file (see `.env.example`):

```bash
DATABASE_URL=postgresql://memo:memo@localhost:5432/memo_mesh
KEY_ENCRYPTION_SECRET=your-secret-key-here  # For encrypting provider API keys
SESSION_SECRET=your-session-secret-here     # For session cookies
```

### Project Conventions

- See [`AGENTS.md`](./AGENTS.md) for development conventions and patterns
- See [`CLAUDE.md`](./CLAUDE.md) for AI assistant guidelines
- See [`dev-plans/mvp-plan-final.md`](./dev-plans/mvp-plan-final.md) for detailed specifications

## 🐳 Self-Hosting

Memo Mesh is designed to be self-hosted on a simple VPS, similar to Supabase or Listmonk.

### Production Deployment

1. **Clone and configure**:
   ```bash
   git clone <your-repo-url>
   cd memo-mesh
   cp .env.example .env
   # Edit .env with production values
   ```

2. **Start services**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

3. **Run migrations**:
   ```bash
   pnpm db:migrate
   ```

4. **Access**:
   - API: `http://your-domain:3000`
   - Dashboard: `http://your-domain:3001` (when implemented)

### Docker Compose

The project includes:
- `docker-compose.dev.yml` - Development (PostgreSQL only)
- `docker-compose.prod.yml` - Production (full stack) - *Coming soon*

## 📖 API Design

### Authentication

- **Dashboard**: Session-based auth (HttpOnly cookies)
- **API**: Project API keys via `X-API-Key` header

### Core Endpoints

```
POST   /v1/auth/register              # User registration
POST   /v1/auth/login                # User login
GET    /v1/auth/me                   # Current user

POST   /v1/projects                  # Create project
GET    /v1/projects                  # List projects

POST   /v1/projects/:id/messages     # Ingest message
POST   /v1/projects/:id/memories/search  # Semantic search
GET    /v1/projects/:id/memories     # List memories
GET    /v1/projects/:id/graph        # Knowledge graph
```

*Full API documentation coming in Stage 9*

## 🔐 Security

- **Provider Keys**: Encrypted at rest using AES-256-GCM
- **Session Cookies**: HttpOnly, Secure, SameSite
- **API Keys**: Auto-generated per project, stored securely
- **Password Hashing**: bcrypt with salt rounds

**Note**: For production deployments, consider using KMS (AWS/GCP) or per-project envelope encryption.

## 🤝 Contributing

This project is currently in active development. Contributions are welcome once we reach Stage 9 (OSS polish).

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Inspired by:
- [Supermemory](https://supermemory.ai/)
- [Mem0](https://mem0.ai/)
- [Supabase](https://supabase.com/) (deployment model)
- [Listmonk](https://listmonk.app/) (self-hosting approach)

## 📚 Resources

- [Development Plan](./dev-plans/plan.md) - Detailed implementation checklist
- [MVP Plan](./dev-plans/mvp-plan-final.md) - Complete specifications
- [AGENTS.md](./AGENTS.md) - Development conventions
- [Prisma Documentation](https://www.prisma.io/docs)
- [Vercel AI SDK](https://ai-sdk.dev/)
- [MCP Specification](https://modelcontextprotocol.io/)

---

**Status**: 🚧 Early Development - Stage 1 Complete

Built with ❤️ for developers who want control over their agent memory systems.
