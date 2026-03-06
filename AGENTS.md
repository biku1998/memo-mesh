# AGENTS.md

## Tooling gotchas

- Node.js version is `22.19.0` (see `.nvmrc`). Enforce via `setup-node` in CI.
- Linter is `oxlint`, formatter is `oxfmt` — not ESLint or Prettier.
- `pnpm -C apps/api test:ci` must invoke `vitest run` (not default watch mode) — watch mode will hang CI silently.

## Prisma / pgvector landmines

- `pgvector` columns use `Unsupported("vector")` in `schema.prisma`. Prisma cannot generate vector indexes — manage them via raw SQL in migration files.
- Never manually edit files under `packages/db/prisma/migrations/`. Always generate a new migration instead.
- Any change to `schema.prisma` requires running `pnpm db:migrate` to regenerate Prisma Client before anything else will compile.

## Security rules

- Never log or return passwords, password hashes, API keys, or provider keys anywhere in the codebase.
- Provider keys are encrypted at rest using `KEY_ENCRYPTION_SECRET`. Always go through the encryption wrapper in `packages/llm` — do not handle raw provider key values directly in route handlers or services.

## **Use shadcn/ui for all UI components.** It is configured in `apps/web`

Do not create custom components for anything shadcn already covers
(buttons, inputs, dialogs, cards, tables, etc.). Check the shadcn
registry first before building anything from scratch.
