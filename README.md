# Money Manager

A self-hosted personal-finance tracker. Each user has their own ledger
of incomes and expenses, grouped by per-user **categories** (income
categories + expense "sales-split" rules with a target allocation
percent). The visibility filter is always the owner's `user_id`, applied
in one place (`server/utils/transactions.ts`, `…/income-categories.ts`,
`…/expense-categories.ts`) and shared by the HTTP API, the MCP tools,
and the prompt endpoints — a new call site can't forget it.

## Stack

- **[Nuxt 4](https://nuxt.com)** (Vue 3, `<script setup>`) + **Nitro** server
- **Prisma 6** + **PostgreSQL**
- **[@nuxt/ui](https://ui.nuxt.com)** + **@nuxtjs/i18n**
- **zod** for request validation, **Vitest** for tests, **pnpm** as the package manager
- Auth is **delegated to an external auth service** — this app validates and
  refreshes tokens, it does not issue them.
- **[MCP](https://modelcontextprotocol.io)** endpoint at `/api/mcp` so an
  external LLM agent can list / create / update / delete transactions and
  categories through the same scoped data-access utilities the HTTP API uses.

The architecture (thin handlers → zod boundary → service layer → scoped Prisma
access, with a typed domain-error taxonomy and fail-fast env validation)
mirrors the sibling [notes](https://github.com/Meizuno/notes) project; see
its `CLAUDE.md` for the prose version of the rules.

## Prerequisites

- **Node 22+** and **pnpm** (see `packageManager` in `package.json`)
- A **PostgreSQL** database
- A reachable **auth service** exposing `/validate` and `/refresh`

## Environment

Configure via `NUXT_`-prefixed env vars (mapped to `runtimeConfig`). Required
env is validated at startup — the server **exits** if it's missing or invalid
(`server/plugins/validate-env.ts`).

| Variable | Required | Purpose |
|---|---|---|
| `NUXT_DATABASE_URL` | ✅ | Postgres connection string |
| `NUXT_AUTH_SERVICE_URL` | ✅ | Base URL of the external auth service |
| `NUXT_MCP_API_KEY` | – | Shared key for the MCP / prompt endpoints; empty disables key auth |

## Setup

```sh
pnpm install                 # also runs: nuxt prepare && prisma generate
pnpm run prisma:migrate      # apply migrations (dev)
pnpm run dev                 # http://localhost:3000
```

If you're using Docker Compose:

```sh
docker compose up --build
docker compose exec app pnpm prisma:migrate
```

## Scripts

| Task | Command |
|---|---|
| Dev server | `pnpm run dev` |
| Build | `pnpm run build` |
| Preview prod build | `pnpm run preview` |
| Typecheck | `pnpm run typecheck` (`nuxt typecheck`) |
| Lint | `pnpm run lint` (`eslint .`) |
| Test | `pnpm run test` · watch: `pnpm run test:watch` |
| Prisma generate | `pnpm run prisma:generate` |
| Prisma migrate (dev) | `pnpm run prisma:migrate` |

`typecheck`, `lint`, and `test` are the verification gate — keep all three
green before committing. CI runs the same three on every push and pull
request; build / deploy depend on `verify` passing.

## Project structure

```
app/         CLIENT — pages (thin), components (dumb), composables (use-cases)
server/
  api/       thin HTTP handlers (parse → validate → service → return)
  services/  business logic (per resource: transactions, income/expense categories)
  utils/     auto-imported helpers — db client, auth, data access, error taxonomy
  middleware/ auth gate, request logging (requestId + structured logs)
  plugins/   startup hooks (env validation)
shared/
  schemas/   zod schemas + inferred types (#shared, used by client + server)
prisma/      schema, migrations
test/        mirrors source (test/server/**)
```

## Resources

The HTTP API exposes three CRUD resources, each backed by a scoped
data-access util that owns the `user_id` filter:

| Resource | URL | Data access | Notes |
|---|---|---|---|
| Transactions | `/api/transactions/*` | `server/utils/transactions.ts` | Income + expense live in separate tables; the util routes between them so callers see one resource |
| Income categories | `/api/income-categories/*` | `server/utils/income-categories.ts` | Auto-coloured + auto-positioned on create |
| Expense categories | `/api/sales-split/*` | `server/utils/expense-categories.ts` | Same as income categories plus a 0–100 % allocation |

The same scoped utilities power the MCP tools in `server/utils/mcp/*`, so the
visibility scope, table routing, and typed not-found errors exist in exactly
one place across HTTP and MCP.

## Testing

Vitest with `@nuxt/test-utils`. Tests default to a node environment; opt into
the Nuxt runtime per-file with `// @vitest-environment nuxt`. Service tests
run against a mocked Prisma client and a fake `event.context` — no HTTP, no
real database.

```sh
pnpm run test
```

## Deployment

CI ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)):

1. **verify** — typecheck + lint + test (every push and PR).
2. **build-and-push** — builds the Docker image and pushes it to GHCR (main / tags only).
3. **deploy** — pulls the image and restarts the service on the VPS via Compose.

A `/api/health` endpoint backs the Docker healthcheck.
