# SubSure Architecture

Status: draft for SUB-2 (scaffold). Expect this to grow as follow-up tickets land.

## 1. Context

SubSure is a subscription _validation_ product: the user must explicitly decide what to do with each detected recurring charge (keep, cancel, downgrade, review later, not-mine, duplicate). See the PRD at `/Users/eric_pharr/Projects/SubSure/Subsure_PRD_v01.md` for product details.

The technical surface area for MVP is:

- account linking + transaction ingestion (Plaid)
- merchant normalization + recurring detection
- decision workflow (validation queue)
- dashboard + renewal timeline
- reminder engine
- auth + accounts

This document locks the shell. The detection engine, queue UX, and reminder engine each get their own ticket and will update this file.

## 2. Stack Decisions

Baseline comes from PRD §26. Any deviation is explicit below.

### Framework — Next.js 14 (App Router) + TypeScript

- One deployable covers UI, server actions, and API routes.
- App Router gives RSC + streaming, which matters for the validation queue (load next card while user decides on current).
- Alt considered: separate `apps/web` + `apps/api` monorepo. Rejected for MVP — one engineer, one deploy, one framework.

### Styling — Tailwind CSS

- PRD baseline. Fast iteration on the validation card UX.
- No component library locked in yet; `src/components/` is hand-rolled until a shadcn-style need appears.

### Database — Postgres on Neon

- PRD calls for managed Postgres.
- Neon picked for MVP: serverless, per-branch databases that match Vercel's preview-per-PR model cleanly. Free tier is enough for dev + preview.
- Migration path: any managed Postgres (RDS, Supabase, Crunchy) is a connection-string swap since Drizzle + `postgres-js` have no Neon-specific bindings.

### ORM / Migrations — Drizzle ORM + drizzle-kit

- **Flip from the PRD-implied default.** PRD doesn't prescribe an ORM; many teams would reach for Prisma.
- Chose Drizzle because:
  1. TS-first schema — no codegen step, no Prisma engine binary.
  2. SQL-close — the detection engine will need window functions and raw queries; Drizzle's escape hatches are first-class.
  3. Smaller cold-start on serverless.
- Tradeoff: Drizzle has less ecosystem polish (studio, seed tooling) than Prisma. Acceptable at this stage.

### Auth — Auth.js (NextAuth v5) with Drizzle adapter

- Battle-tested, session model lands in Postgres via `@auth/drizzle-adapter`.
- Session strategy: **database** (not JWT). We want server-side revocation for `Sign out everywhere` and Plaid token ties to sessions later.
- This ticket ships route stubs + schema tables. SUB auth ticket wires providers (email magic link + Google).

### Background jobs — Vercel Cron + DB-backed job table (deferred)

- **Flip from a dedicated worker (BullMQ, Inngest, Temporal).**
- MVP cadence (hourly Plaid refresh, daily reminder sweep) fits Vercel Cron + a `jobs` table with idempotency keys.
- Revisit when either (a) per-user job volume exceeds cron granularity, or (b) detection engine needs fan-out.

### Plaid — `plaid-node` SDK (deferred wiring)

- MVP aggregator per PRD. Env slots reserved: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`.
- Actual integration ships in SUB Plaid ticket.

### Analytics — PostHog

- **Flip from Mixpanel option in PRD.**
- PostHog picked because it is self-hostable, event-centric, and includes session replay (we will want that for validation queue UX iteration). Free tier is generous.
- Env slot reserved: `POSTHOG_KEY`. Instrumentation ships later.

### Error monitoring — Sentry (deferred)

- Env slot reserved: `SENTRY_DSN`.
- Wired when the auth ticket lands and first real request paths exist.

### Hosting — Vercel

- PRD baseline. Preview per PR, prod on main. Neon integration keyed to Vercel project.

### Testing — Vitest + Playwright

- Vitest for unit tests of the detection engine and utilities. Native TS, no Jest transform config.
- Playwright (later) for a single golden-path e2e: link a Plaid sandbox account, see validation queue, make a decision, see it reflected.

### Lint / format — ESLint (next config) + Prettier

- Standard Next.js lint config, plus `eslint-config-prettier` to defer formatting to Prettier.
- Prettier enforces formatting. `prettier-plugin-tailwindcss` sorts class names.
- CI runs `format:check`, `lint`, `typecheck`, `test`, `build`.

### Package manager — npm

- npm chosen because both Vercel and local claude runs have it out of the box.
- Revisit pnpm when monorepo structure appears.

## 3. Environments

| Env     | Where            | DB                                | Notes                  |
| ------- | ---------------- | --------------------------------- | ---------------------- |
| dev     | `next dev` local | Neon dev branch or local Postgres | Each engineer picks    |
| preview | Vercel per-PR    | Neon preview branch per git ref   | Auto-provisioned       |
| prod    | Vercel main      | Neon prod branch                  | Single source of truth |

`.env.example` ships the full variable surface. Real values live in Vercel project env + local `.env` (gitignored).

## 4. Repo Layout

See `README.md` §Folder layout. High-level:

```
src/app       routes (UI + API) — App Router
src/lib       shared server/client code (auth, plaid client later, etc.)
src/db        drizzle schema, client, migrations
src/env.ts    zod-validated env
tests/        vitest
.github/      CI, PR template, CODEOWNERS
```

## 5. Data Model Sketch

Auth.js tables: `user`, `account`, `session`, `verificationToken` (verbatim adapter shape).

Domain stubs in this ticket:

- `financial_account` — linked Plaid accounts.
- `subscription_candidate` — detected recurring charge.

The full product schema (transactions, validation_decision, alert, savings_event) lands in the Plaid + detection tickets so shape follows real queries, not speculation.

## 6. Deployment Flow

1. PR opened → GH Actions CI runs (`format:check`, `lint`, `typecheck`, `test`, `build`).
2. Vercel builds preview deploy against the Neon preview branch for that git branch.
3. Reviewer approves, merges to `main`.
4. Vercel deploys `main` to prod, pointed at the Neon prod branch.
5. Migrations run via the `db:migrate` script as a Vercel build command (to be wired in the Plaid ticket once we have real migrations beyond the scaffold).

## 7. Open architectural questions

- Session strategy long-term: do we keep database sessions or cut to JWT once auth is mature? Revisit when multi-device concerns appear.
- Detection engine: pure SQL vs offline batch (Node worker) vs future ML step. Decision in the detection ticket, driven by first-pass precision/recall numbers.
- Mobile-first vs web-first (PRD open question §27). Current scaffold is web. Mobile stays a PWA at minimum.
