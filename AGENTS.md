# AGENTS.md — Project instructions for coding agents

This repo is a **self-hostable memory layer for LLM agents** built as a **TypeScript monorepo** using **pnpm workspaces**.

Goals:

- Fast iteration with consistent patterns
- Strong validation (Zod)
- Reliable CI gates (typecheck, lint, format, tests)
- Evidence-first memory system (facts always link back to raw messages)
- Self-hostable deployment (easy VPS setup, similar to Supabase/Listmonk)

## Repo layout

- `apps/api` — Fastify backend (Node.js)
  - REST API
  - Email/password auth (session cookies)
  - Project API keys (`X-API-Key` header)
  - Zod validation
  - Prisma ORM
  - Postgres + pgvector (vector search)
  - Vercel AI SDK (embeddings + extraction)
  - Vitest (backend tests)
- `apps/web` — React frontend dashboard
  - TanStack Router (routing)
  - TanStack Query (server state)
  - Read-only UI (no editing/deletion)
  - Graph visualization (Cytoscape.js or Sigma.js)
  - Evidence-first UX (show source messages)
- `apps/mcp` — MCP server
  - MCP TypeScript SDK
  - Exposes memory tools (add/search/graph/entity)
  - Wraps HTTP API calls
- `packages/shared` — shared zod schemas, types, utils
- `packages/llm` — Vercel AI SDK wrappers (embed/extract)
- `packages/db` — Prisma schema + migrations
- `packages/shared-config` — shared TSConfig, oxlint config

## Primary commands (pnpm)

Install:

- `pnpm install`

Dev:

- `pnpm dev` (runs api + web + mcp concurrently)
- `pnpm -C apps/api dev`
- `pnpm -C apps/web dev`
- `pnpm -C apps/mcp dev`

Build:

- `pnpm build`

Typecheck:

- `pnpm typecheck`

Lint (oxlint):

- `pnpm lint`
- `pnpm lint:fix`

Format (oxfmt):

- `pnpm fmt` (write)
- `pnpm fmt:check` (CI check)

Tests:

- `pnpm test` — runs all tests (Vitest across monorepo)
- `pnpm -C apps/api test` — backend tests only
- `pnpm -C apps/api test:ci` — should run `vitest run`

> If any script doesn't exist yet, prefer adding it at the repo root and wiring it to each workspace.

## Database (Postgres via Docker)

Development DB uses docker-compose.

Expected files:

- `docker-compose.dev.yml` (local development — Postgres only)
- `docker-compose.prod.yml` (optional, production-like — full stack)

Common workflows:

- Start dev DB: `pnpm db:up`
- Stop dev DB: `pnpm db:down`
- Reset dev DB: `pnpm db:reset` (destructive)

If adding/changing DB config:

- Use `.env.local` (local, gitignored) + `.env.example` (documented)
- Document any new env vars in README or this file

## ORM & migrations (Prisma)

We use Prisma for schema, migrations, and generated client.

Key files:

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/*`

Commands (recommended scripts at repo root):

- `pnpm db:up` / `pnpm db:down` — start/stop dev Postgres
- `pnpm db:migrate` — create/apply migrations in development
- `pnpm db:migrate:deploy` — apply existing migrations (CI/production)
- `pnpm db:studio` — inspect data locally
- `pnpm db:seed` — seed dev data (if present)

Rules:

- Any change to `schema.prisma` must be accompanied by a migration (`pnpm db:migrate`) unless explicitly documented otherwise.
- After pulling changes with new migrations, run `pnpm db:migrate` and ensure Prisma Client is regenerated.
- Never edit files under `prisma/migrations/*` manually unless you know exactly why; prefer generating a new migration.
- pgvector fields use `Unsupported("vector")` pattern in Prisma; manage indexes via SQL migrations.

## Backend conventions (apps/api)

### REST + Fastify

- Keep routes modular by domain:
  - `auth`, `projects`, `messages`, `memories`, `graph`, etc.
- Keep request/response schemas close to the handler.
- Use consistent error shapes (avoid ad-hoc error formats).
- All endpoints scoped by `projectId` (except auth/admin).

### Validation (Zod)

- All external inputs must be validated at runtime:
  - request body
  - params
  - query
- Prefer Zod schemas as the single source of truth for DTOs.
- Extraction output must validate against strict zod schemas (repair + retry on failure).

### Auth & sessions

**Dashboard (Web UI):**

- Email + password registration/login
- Session-based auth (HttpOnly cookies, no JWT)
- Same user credentials for dashboard access

**API (for agents/integrations):**

- Project API keys via `X-API-Key` header
- One active API key per project (auto-generated)
- Key lookup middleware validates project access

**Security:**

- Never log passwords, password hashes, or API keys.
- Never return password hashes or raw API keys in responses.
- Provider keys encrypted at rest (`KEY_ENCRYPTION_SECRET` env var).

Cookie guidance:

- `httpOnly: true`
- `sameSite: "lax"` (or stricter if feasible)
- `secure: true` in production
- Consider `path`, `domain`, and expiry carefully

### LLM integration (Vercel AI SDK)

- Use `packages/llm` wrappers for embeddings and extraction.
- Default models: `gpt-4o-mini` (extraction), `text-embedding-3-small` (embeddings).
- One provider per project (OpenAI or Anthropic).
- Global provider keys stored encrypted (one per provider).
- Handle extraction failures gracefully (repair + retry once, then log and continue).

### Memory consolidation

- When new fact extracted: embed → search existing facts → if similarity > threshold, mark old as `superseded`, create new as `active`.
- Newer facts override older ones (simple override policy for MVP).
- Preserve evidence chain (both memories link to source messages).

## API contract (REST)

- Backend is REST.
- Prefer consistent resource naming and HTTP semantics.
- All endpoints scoped by `projectId` (except auth/admin).
- Search returns facts by default; raw memories via `?includeRaw=true`.
- Context pack structure: deduped preferences, grouped by entity, with evidence.

## Frontend conventions (apps/web)

### Routing (TanStack Router)

- Keep route tree consistent with existing structure.
- Prefer route loaders where appropriate; otherwise use Query hooks.

### Server state (TanStack Query)

- All server state goes through Query (no duplication in client state).
- Use stable query keys.
- Prefer invalidation on mutation success.

### UI (read-only dashboard)

- Dashboard is **read-only** (no editing/deletion via UI).
- Show evidence for every fact/relation (link to source messages).
- Graph visualization: interactive graph with side panel for entity details.
- Memory Explorer: filter by type/status, show confidence + createdAt.

### Graph visualization

- Use Cytoscape.js or Sigma.js for knowledge graph.
- Click node → side panel with entity details, relations, evidence.
- Show provenance (which memories created which relations).

## MCP server conventions (apps/mcp)

- Use MCP TypeScript SDK (`@modelcontextprotocol/sdk`).
- Expose tools only: `memory.add`, `memory.search`, `memory.graph`, `memory.entity`.
- Tools wrap HTTP API calls (use project API key stored server-side).
- Return context pack format (structured JSON for agents).

## Linting & formatting (oxc)

Use **oxlint** for linting and **oxfmt** for formatting.

Local dev:

- `pnpm lint`
- `pnpm lint:fix`
- `pnpm fmt` (write)
- `pnpm fmt:check` (CI check)

Pre-commit:

- Use `lint-staged` + `husky` to auto-format staged files with `oxfmt`.
- CI must still enforce `pnpm fmt:check` so formatting is not "best effort."

## CI requirements (GitHub Actions)

On every PR targeting `main`, these must pass (merging should be blocked otherwise):

- `pnpm typecheck`
- `pnpm lint`
- `pnpm fmt:check`
- `pnpm test`

Additional notes:

- Use pnpm caching in CI for speed.
- Run Prisma migrations in CI before tests.
- Ensure Node.js v22.19.0 is used (via `.nvmrc` or `setup-node` action).

## Environment variables

- Local dev uses `.env.local` (not committed).
- `.env.example` must be kept updated when adding/changing env vars.
- Never commit secrets.

Common env vars include:

- `DATABASE_URL` (Postgres connection string)
- `KEY_ENCRYPTION_SECRET` (for encrypting provider API keys)
- `SESSION_SECRET` (for session cookies)
- `WEB_ORIGIN` / `CORS_ORIGIN` (if applicable)
- `NODE_ENV` (development/production)

## Agent workflow rules

### Before you change code

1. Read this file + relevant package docs.
2. Identify the correct workspace (`apps/api` vs `apps/web` vs `apps/mcp` vs `packages/*`).
3. Prefer existing patterns over inventing new ones.
4. Review MVP plan (`dev-plans/mvp-plan-final.md`) for product context.

### While changing code

- Keep changes scoped and reversible.
- Avoid introducing new libraries unless necessary.
- Update types + tests with behavior changes.
- Document new env vars and scripts.
- Maintain evidence-first approach (facts link to source messages).
- Preserve auditability (where did this fact come from?).

### After changing code

Run the smallest set of checks that gives confidence:

- Web-only: `pnpm -C apps/web typecheck` + relevant tests
- API-only: `pnpm -C apps/api typecheck` + `pnpm -C apps/api test`
- MCP-only: `pnpm -C apps/mcp typecheck` + relevant tests
- DB changes: ensure migrations are created and tested
- If unsure: run root `pnpm typecheck`, `pnpm lint`, `pnpm fmt:check`, and CI-equivalent tests.

## Key principles

1. **Evidence-first memory**: Facts always link back to raw messages.
2. **Strict JSON extraction**: Zod validation, repair + retry on failure.
3. **Context pack output**: Agent-ready, structured JSON (not prose).
4. **Self-hostable**: Easy VPS deployment, Docker Compose, clear README.
5. **Open-ended graph**: No rigid schemas, LLM-driven extraction (open enums for `kind` and `predicate`).
