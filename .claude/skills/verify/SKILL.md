---
name: verify
description: Run the project's verification gate — typecheck, lint, tests (plus optional security/build) — and report any failures.
---

# Verify

Run the verification suite for this project. **Do this before declaring work
done** and before any `/git-commit` or `/git-push`.

> **CI runs the same gate.** The GitHub workflow
> ([.github/workflows/deploy.yml](../../../.github/workflows/deploy.yml)) has a
> `verify` job (typecheck + lint + test) that runs on pushes and PRs;
> build/deploy depend on it. Running it locally first is what keeps PRs green —
> treat a red check as a real blocker, not advisory.

## Core gate (always run)

Execute in this order, **stop on first failure**:

### 1. Type checker — must be clean

```sh
pnpm run typecheck
```

Runs `nuxt typecheck` (vue-tsc). Expected: exit 0, no `error TS...` lines.

Notes:
- Needs the Prisma client generated first (`pnpm run prisma:generate`, also run
  by `postinstall`) — otherwise server types report missing `NoteVisibility` /
  `NoteWhereInput`.
- A non-fatal `vue-router/volar/sfc-route-blocks` warning may print (vue-tsc ↔
  vue-router compat). It does not fail the run; exit code is what matters.
- Do **not** silence errors with `@ts-ignore` / `@ts-expect-error` — fix the
  type. A genuine external-typing gap may carry one inline-commented exception.

### 2. Linter — must be clean

```sh
pnpm run lint
```

Runs `eslint .` via the `@nuxt/eslint` flat config. Expected: exit 0, zero
problems. Auto-fixable issues: `pnpm exec eslint . --fix`. Do **not** add
`// eslint-disable` to silence — fix the underlying issue; a real false positive
gets a disable comment **with a one-line reason**.

### 3. Tests — must pass

```sh
pnpm run test
```

Runs `vitest run`. Expected: all tests pass. Don't mark a test `.skip` to get
green. New service/util/composable logic should arrive with tests (see CLAUDE.md
"Tests").

## Thorough gate (optional — slower, run when it matters)

Run these additionally before a release, a risky merge, or when the human asks
for a deeper check.

### 4. Production build

```sh
pnpm run build
```

Runs `nuxt build`. Catches issues the type/lint pass misses (SSR-only failures,
bad imports, build-time config). Slower; needs no database.

### 5. Dependency audit — known CVEs

```sh
pnpm audit
```

Expected: no high/critical advisories in declared dependencies. If one appears:
bump the affected dep (or its parent for transitive ones); if no fix exists yet,
surface it to the human rather than ignoring.

## Report format

After the core gate, report:

```
✅ typecheck: clean
✅ lint:      clean
✅ test:      12/12 passed
```

If something failed, stop the chain and show what broke and what was skipped:

```
❌ typecheck: 2 errors
   - server/services/notes.ts(14,3): TS2345 ...
   - app/pages/notes/[id].vue(40,7): TS2322 ...

⏭️ lint: skipped (typecheck failed)
⏭️ test: skipped (typecheck failed)
```

Then **fix the failures** before continuing. Never suggest "ignoring" or
"skipping" them.

## When to run

- ✅ Before `/git-commit` and before `/git-push`
- ✅ Before declaring a task complete
- ✅ After resolving a merge / rebase
- ✅ After adding a service, schema, composable, or handler refactor
- ✅ When the human asks "is everything green?"

## Common failures and fixes

- **`error TS2305: '@prisma/client' has no exported member 'NoteVisibility'`** —
  the Prisma client isn't generated. Run `pnpm run prisma:generate`.
- **`error TS2322: '"PUT"' is not assignable to '"GET" | ...'`** — Nitro
  typed-route method inference on a dynamic URL. Widen the request
  (`` `/api/notes/${id}` as string ``) for the mutation, or type it explicitly.
- **eslint `@typescript-eslint/no-explicit-any`** — replace `any` with a precise
  type, `unknown` + narrowing, or an inferred zod / Prisma type (CLAUDE.md: no
  `any`).
- **eslint `no-empty`** — an intentionally empty `catch` needs a comment
  explaining why (`catch { /* best-effort: ... */ }`).
- **vitest can't import a server util** — import via a relative path from
  `test/`; node-environment tests don't have Nuxt aliases unless the file opts
  into the Nuxt environment (`// @vitest-environment nuxt`).

## Do not

- ❌ Skip a check and call the suite green — it's a chain
- ❌ Silence with `@ts-ignore`, `// eslint-disable`, or `.skip` instead of fixing
- ❌ Declare a task done with any core check failing
- ❌ Report a missing script as a pass — say it's missing
