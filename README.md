# SubSure

Validate every recurring charge you pay for.

SubSure turns passive subscription detection into an intentional decision workflow: for each recurring charge, the user must confirm whether it is still wanted, still used, correctly priced, and worth keeping.

See `ARCHITECTURE.md` for stack decisions and `/Users/eric_pharr/Projects/SubSure/Subsure_PRD_v01.md` for the product definition.

## Operations runbooks

- `docs/operations/launch-canary-rollback-runbook.md` — launch verification sequence, canary criteria, rollback triggers/steps, and signoff template.

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

| Script               | What it does                                             |
| -------------------- | -------------------------------------------------------- |
| `dev`                | Next.js dev server                                       |
| `build`              | Next.js production build                                 |
| `start`              | Run the built app                                        |
| `lint`               | ESLint via `next lint`                                   |
| `format`             | Prettier write                                           |
| `format:check`       | Prettier check (used in CI)                              |
| `typecheck`          | `tsc --noEmit` with strict + `noUncheckedIndexedAccess`  |
| `test`               | Vitest run                                               |
| `eval:subscriptions` | Runs offline fixture precision/recall evaluation harness |
| `verify:launch`      | Credential-gated launch smoke checks + pass/fail summary |
| `verify:launch:mock` | Mock-mode launch smoke harness for credential-absent envs |
| `db:generate`        | drizzle-kit: generate SQL migrations from schema         |
| `db:migrate`         | Apply migrations in `src/db/migrations`                  |
| `db:push`            | drizzle-kit push (dev shortcut, skip for prod)           |
| `db:studio`          | drizzle-kit studio                                       |

Launch verification command (used for SUB-45 canary signoff):

```bash
npm run verify:launch -- \
  --auth-cookie "$AUTH_COOKIE"
```

Options:
- `--app-url` defaults to `NEXTAUTH_URL`, then `http://localhost:3000`
- `--auth-cookie` can be provided via `VERIFY_LAUNCH_AUTH_COOKIE` env var
- `--cron-secret` defaults to `PLAID_REFRESH_CRON_SECRET`
- `--expected-plaid-env` defaults to `development`
- `--timeout-ms` defaults to `15000`
- `--skip-env-check` bypasses local required-env validation (use only when envs are validated externally)
- `--mock-mode` uses in-memory endpoint responses to exercise smoke-flow shape without credentials

Mock-mode example:

```bash
npm run verify:launch:mock
```

## Environments

- **dev** — local `next dev` against a Neon dev branch or local Postgres.
- **preview** — Vercel preview per PR, Neon preview branch keyed off the git branch.
- **prod** — Vercel main, Neon prod branch.

Each env has its own set of `.env` values (DATABASE_URL, NEXTAUTH_SECRET, Plaid keys, etc.). Vercel project env vars are the source of truth for preview/prod.

### Plaid env cutover switch

- `PLAID_ENV` is the single cutover toggle (`sandbox`, `development`, `production`).
- SUB-4 ships against sandbox/Development-tier credentials.
- Do not enable production credentials until board approval gates are met.

### Plaid API surface (SUB-4)

- `POST /api/plaid/link-token` — create Link token for authenticated user.
- `POST /api/plaid/exchange-public-token` — exchange public token, persist item/accounts, run historical import via `/transactions/sync`.
- `POST /api/plaid/refresh` — manual authenticated refresh for all linked user items.
- `GET /api/plaid/status` — linked-item status + reconnect-required flags + manual fallback status.
- `POST|GET /api/cron/plaid-refresh` — scheduled refresh for all users (optional `PLAID_REFRESH_CRON_SECRET` protection).
- `POST /api/plaid/webhook` — handles ITEM error/reauth signals and transaction update webhooks.

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
    app/page.tsx                    protected app surface scaffold
    api/
      auth/[...nextauth]/route.ts   Auth.js handler
      session/route.ts              GET current session (401 when signed out)
    login/page.tsx                  credentials scaffold form
    signup/page.tsx                 placeholder + sign-in redirect
    page.tsx                        landing placeholder
    layout.tsx                      root layout + Tailwind
    globals.css
  middleware.ts                     route guards for auth/protected pages
  db/
    client.ts                       drizzle client
    schema.ts                       Auth.js tables + domain sketches
    migrate.ts                      apply migrations
    migrations/                     generated SQL
  lib/
    auth.ts                         NextAuth config
    plaid/                          Plaid client + sync orchestration
    reminder-delivery-pipeline.ts   reminder dispatch retry/backoff/idempotency helpers
    merchant-normalization.ts       merchant canonicalization helpers
    evaluation/                     offline fixture data + precision/recall evaluator
scripts/
  evaluate-subscription-fixtures.ts offline precision/recall harness runner
  env.ts                            zod-validated env
tests/
  smoke.test.ts                     CI sanity
  merchant-normalization.test.ts    merchant normalization unit coverage
  reminder-delivery-pipeline.test.ts retry/dead-letter/idempotency coverage
  subscription-evaluation.test.ts   fixture-harness metric regression test
.github/
  workflows/ci.yml
  PULL_REQUEST_TEMPLATE.md
  CODEOWNERS
```

## Follow-ups

Child tickets of SUB-2 land the real product work — full signup/password management, Plaid ingestion, recurring-detection engine, validation queue UX, dashboard, reminder engine.
