# SubSure

Validate every recurring charge you pay for.

SubSure turns passive subscription detection into an intentional decision workflow: for each recurring charge, the user must confirm whether it is still wanted, still used, correctly priced, and worth keeping.

See `ARCHITECTURE.md` for stack decisions and `/Users/eric_pharr/Projects/SubSure/Subsure_PRD_v01.md` for the product definition.

## Prerequisites

- Node.js 20.11+
- A Postgres 14+ database (local docker or a Neon dev branch)

## Getting started

```bash
npm install
cp .env.example .env
# edit .env: set DATABASE_URL and NEXTAUTH_SECRET
npm run db:generate   # emits SQL migrations from src/db/schema.ts
npm run db:migrate    # applies migrations against DATABASE_URL
npm run dev           # http://localhost:3000
```

## Scripts

| Script         | What it does                                            |
| -------------- | ------------------------------------------------------- |
| `dev`          | Next.js dev server                                      |
| `build`        | Next.js production build                                |
| `start`        | Run the built app                                       |
| `lint`         | ESLint via `next lint`                                  |
| `format`       | Prettier write                                          |
| `format:check` | Prettier check (used in CI)                             |
| `typecheck`    | `tsc --noEmit` with strict + `noUncheckedIndexedAccess` |
| `test`         | Vitest run                                              |
| `db:generate`  | drizzle-kit: generate SQL migrations from schema        |
| `db:migrate`   | Apply migrations in `src/db/migrations`                 |
| `db:push`      | drizzle-kit push (dev shortcut, skip for prod)          |
| `db:studio`    | drizzle-kit studio                                      |

## Environments

- **dev** — local `next dev` against a Neon dev branch or local Postgres.
- **preview** — Vercel preview per PR, Neon preview branch keyed off the git branch.
- **prod** — Vercel main, Neon prod branch.

Each env has its own set of `.env` values (DATABASE_URL, NEXTAUTH_SECRET, Plaid keys, etc.). Vercel project env vars are the source of truth for preview/prod.

## Deploy

1. Connect the repo to Vercel (root directory = repo root).
2. Set env vars per environment in the Vercel project settings.
3. Connect a Neon project; create a branch for `preview` (auto-per-branch) and one for `production`.
4. Preview deploys are triggered per PR. Prod deploys on merge to `main`.

> Vercel + Neon hookup is a manual board action — CI is ready but no remote repo is connected yet.

## Folder layout

```
src/
  app/                 Next.js App Router routes
    api/
      auth/[...nextauth]/route.ts   Auth.js handler
      session/route.ts              GET current session
    login/page.tsx                  stub
    signup/page.tsx                 stub
    page.tsx                        landing placeholder
    layout.tsx                      root layout + Tailwind
    globals.css
  db/
    client.ts                       drizzle client
    schema.ts                       Auth.js tables + domain sketches
    migrate.ts                      apply migrations
    migrations/                     generated SQL
  lib/
    auth.ts                         NextAuth config
  env.ts                            zod-validated env
tests/
  smoke.test.ts                     CI sanity
.github/
  workflows/ci.yml
  PULL_REQUEST_TEMPLATE.md
  CODEOWNERS
```

## Follow-ups

Child tickets of SUB-2 land the real product work — auth providers, Plaid ingestion, recurring-detection engine, validation queue UX, dashboard, reminder engine.
