# Launch Canary + Rollback Runbook

Purpose: execute a fast, deterministic launch verification pass once provider credentials are handed off, with pre-defined pass/fail criteria and rollback steps.

Related tickets:
- [SUB-46](/SUB/issues/SUB-46) (this runbook)
- [SUB-45](/SUB/issues/SUB-45) (execution task that uses this runbook)
- [SUB-44](/SUB/issues/SUB-44) (credential handoff dependency)
- [SUB-48](/SUB/issues/SUB-48) (post-launch canary report template)
- [SUB-51](/SUB/issues/SUB-51) (rollback dry-run + operator checklist rehearsal)

Report template:
- `docs/operations/post-launch-canary-report-template.md`

## 0) Preconditions

Do not start the canary until all are true:

- [ ] `SUB-44` confirms email-provider credentials are provisioned and accessible.
- [ ] Runtime envs are set for the target environment:
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
  - `PLAID_CLIENT_ID`
  - `PLAID_SECRET`
  - `PLAID_ENV=development` for launch verification (not `sandbox`)
  - `PLAID_REFRESH_CRON_SECRET` (recommended to protect cron route)
- [ ] App deploy candidate is built from the exact commit to be promoted.
- [ ] At least one test user exists with a linked Plaid item in dev tier.
- [ ] A second observer (QA or manager) is available during the canary window.

## 1) Preflight (must pass before canary traffic)

Run from repo root:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

If any command fails: stop and fix before continuing.

Run the automated launch verification check against the deployed candidate:

```bash
npm run verify:launch -- \
  --app-url "$APP_URL" \
  --auth-cookie "$AUTH_COOKIE" \
  --cron-secret "$PLAID_REFRESH_CRON_SECRET"
```

Expected behavior:
- exits `0` only when all required checks pass
- exits non-zero on any failed env or endpoint check
- prints a pass/fail summary that can be copied into [SUB-45](/SUB/issues/SUB-45) signoff notes

## 2) Baseline snapshot (T-0)

Capture baseline before enabling canary:

- [ ] Commit SHA + deploy URL
- [ ] Current `PLAID_ENV` value
- [ ] Existing Plaid status sample from authenticated session:

```bash
curl -sS "$APP_URL/api/plaid/status" -H "Cookie: <auth-cookie>" | jq
```

Expected healthy shape:
- `plaidEnabled: true`
- `plaidEnvironment: "development"`
- `reconnectRequiredItems: 0` for the canary user cohort

- [ ] Cron endpoint probe (authorized):

```bash
curl -sS -X POST "$APP_URL/api/cron/plaid-refresh" \
  -H "Authorization: Bearer $PLAID_REFRESH_CRON_SECRET" | jq
```

Expected:
- Non-401 response
- JSON includes `refreshedItems`
- `errorCount == 0` for canary baseline

## 3) Canary execution sequence

Use a limited cohort (recommended: 1-5 internal users) for 30 minutes.

1. Deploy canary build to production target with no schema changes pending.
2. Confirm auth path works:
   - user can sign in
   - `/api/session` returns authenticated session
3. Plaid health checks (per canary user):
   - `GET /api/plaid/status`
   - trigger `POST /api/plaid/refresh`
   - verify no `reconnect_required` transition for healthy items
4. Reminder preference checks:
   - `GET /api/notification-preferences`
   - `PUT /api/notification-preferences` toggles between `email` and `none`
5. Cron sweep check:
   - execute one authorized `POST /api/cron/plaid-refresh`
   - verify result set contains no item with `status: "error"`
6. Webhook smoke (if webhook URL configured):
   - send a valid Plaid transactions webhook event
   - verify endpoint `POST /api/plaid/webhook` returns `{ "ok": true, ... }`

## 4) Canary pass/fail criteria

Pass all criteria to continue rollout:

- [ ] Availability: all canary API checks return non-5xx.
- [ ] Auth: 100% of canary users can establish a session.
- [ ] Plaid ingestion: `errorCount == 0` from cron refresh output.
- [ ] Reauth churn: `reconnectRequiredItems` does not increase for healthy canary users.
- [ ] Data freshness: each canary-linked account shows updated `lastRefreshedAt` after manual refresh.
- [ ] Reminders settings integrity: preference writes/readbacks stay consistent.

Immediate fail (trigger rollback):

- Any sustained 5xx on auth, plaid status, plaid refresh, or cron routes.
- Cron refresh returns item-level `status: "error"` for >= 20% of canary items.
- Authenticated Plaid status reports `plaidEnabled: false` unexpectedly.
- Widespread `reconnect_required` regressions introduced by new deploy.
- Data corruption signal (missing linked accounts or unexpected transaction deletions).

## 5) Rollback plan

Rollback decision owner: on-call CTO (or delegated incident lead).

### Trigger

Trigger rollback immediately if any fail criterion is met and cannot be corrected within 10 minutes.

### Steps

1. Freeze rollout and notify stakeholders in issue comments for [SUB-45](/SUB/issues/SUB-45).
2. Promote previous known-good deployment.
3. Revert any launch-only env changes made for canary.
4. Re-run baseline probes against rolled-back build:
   - `GET /api/plaid/status`
   - `POST /api/plaid/refresh`
   - `POST /api/cron/plaid-refresh`
5. Confirm restored healthy signals:
   - `plaidEnabled: true`
   - `errorCount == 0`
   - no new reconnect-required spike
6. Capture incident notes:
   - trigger condition
   - UTC timeline
   - affected scope
   - mitigation + next fix ticket

## 5.1) Operator checklist (who does what)

Use this checklist during rollback so responsibilities are unambiguous.

| Role | Primary responsibilities | Must confirm before handoff |
| --- | --- | --- |
| Incident lead (CTO or delegate) | declares rollback, timeboxes hot-fix attempt to 10 minutes, runs bridge updates every 5 minutes | trigger matched fail criteria; rollback command approved |
| Deployer operator | promotes previous known-good build, confirms release version hash, monitors deploy health | active version now equals expected previous SHA |
| Config operator | reverts launch-only env/config toggles changed for canary | all rollback env vars match pre-canary snapshot |
| Verifier (QA/observer) | runs post-rollback API probes and compares to T-0 baseline | all required checks pass; no reconnect spike |
| Scribe | records timeline, commands run, decision log, and links evidence | issue comment contains full UTC timeline and outcomes |

Execution order:
1. Incident lead calls rollback and assigns named people to all five roles.
2. Deployer operator restores known-good build and posts deployed SHA.
3. Config operator reverts launch-only settings and posts diff summary.
4. Verifier executes sanity probes and reports pass/fail.
5. Incident lead announces rollback-complete or escalates to incident response.

## 5.2) Dry-run rehearsal record (non-destructive)

Rehearsal date (UTC): `2026-04-19`  
Mode: tabletop + command simulation against runbook steps (no production mutation)

| Step | Owner | Target time | Rehearsal result |
| --- | --- | --- | --- |
| Detect fail criterion and declare rollback | Incident lead | <= 2 min | PASS - decision path is explicit and timeboxed |
| Identify previous good SHA and promotion command | Deployer operator | <= 3 min | PASS - operator can pull SHA from deploy history before command |
| Revert canary-only env changes | Config operator | <= 4 min | PASS - env checklist is complete and references T-0 baseline |
| Run post-rollback sanity probes (`/api/plaid/status`, `/api/plaid/refresh`, `/api/cron/plaid-refresh`) | Verifier | <= 5 min | PASS - probe list and expected outputs are clear |
| Publish incident note with trigger/timeline/outcome | Scribe | <= 3 min | PASS - note requirements are explicit in section 5 |

Observed rehearsal risks and mitigations:
- Risk: role ambiguity during active incident can slow first 5 minutes.  
  Mitigation: assign all five roles up-front using section 5.1 before any commands.
- Risk: env rollback drift if canary edits are not captured at T-0.  
  Mitigation: require baseline snapshot completion from section 2 before canary starts.
- Risk: partial verification can falsely mark rollback as complete.  
  Mitigation: verifier must run all three post-rollback probes before signoff.

## 6) Observation window and signoff

Observation window after canary pass: 30 minutes minimum with no fail criteria triggered.

If stable through window:

- Mark canary as passed.
- Post signoff on [SUB-45](/SUB/issues/SUB-45) using template below.
- Proceed to close [SUB-45](/SUB/issues/SUB-45) if all launch checks are complete.

## 7) SUB-45 signoff template

Copy/paste into [SUB-45](/SUB/issues/SUB-45) comment when execution completes:

```md
Launch verification completed for [SUB-45](/SUB/issues/SUB-45).

Canary scope:
- build: <sha>
- cohort size: <n>
- start/end UTC: <time range>

Results:
- preflight: PASS/FAIL
- auth/session checks: PASS/FAIL
- plaid status + refresh checks: PASS/FAIL
- cron plaid refresh check: PASS/FAIL
- reminder preference checks: PASS/FAIL
- webhook smoke (if enabled): PASS/FAIL or N/A

Canary decision: PASS/FAIL
Rollback executed: YES/NO

Notes:
- <key metrics and anomalies>
- <follow-up ticket links if any>
```
