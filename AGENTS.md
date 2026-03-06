# AGENTS.md

## Tooling

- Use `pnpm`. Never `npm` or `yarn`.
- Node.js version: `22.19.0` (see `.nvmrc`).
- Linter is `oxlint`, formatter is `oxfmt` — not ESLint or Prettier.
- `pnpm -C apps/api test:ci` must use `vitest run`, not watch mode — watch mode silently hangs CI.

## Prisma / pgvector

- `pgvector` columns use `Unsupported("vector")` in `schema.prisma`. Prisma cannot generate vector indexes — manage them via raw SQL in migration files.
- Never manually edit files under `packages/db/prisma/migrations/`. Always generate a new migration instead.
- Any change to `schema.prisma` requires running `pnpm db:migrate` to regenerate Prisma Client before anything else will compile.

## Security

- Never log or return passwords, password hashes, API keys, or provider keys anywhere.
- Provider keys are encrypted at rest via `KEY_ENCRYPTION_SECRET`. Always use the encryption wrapper in `packages/llm` — never handle raw provider key values directly in route handlers or services.

## UI components

- Use shadcn/ui for all UI components — it is configured in `apps/web`. Do not build custom components for anything shadcn already covers (buttons, inputs, dialogs, cards, tables, etc.). Check the shadcn registry before building anything from scratch.

## Context and Progress

For context read the `README.md` to understand what this project is about if needed, Not necessary for every session or interaction.

And for plan and how we are implementing it read `dev-plans/plan.md`, again same thing only read if needed, Not necessary for every session or interaction.
