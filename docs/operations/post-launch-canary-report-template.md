# Post-Launch Canary Report Template

Purpose: capture a consistent 30-60 minute canary observation record after launch so the release owner can make a clear go/no-go decision.

Related tickets:
- [SUB-48](/SUB/issues/SUB-48)
- [SUB-45](/SUB/issues/SUB-45)

## 1) Run Metadata

- Date (UTC): `<YYYY-MM-DD>`
- Environment: `<production|staging>`
- Build/commit: `<git-sha>`
- App URL: `<url>`
- Canary window (UTC): `<start> -> <end>`
- Observation length: `<30|45|60>` minutes
- Cohort size: `<n users/accounts>`
- Report owner: `<name/role>`
- Secondary observer: `<name/role>`

## 2) Watch Metrics (sample every 5-10 min)

Record values at each checkpoint.

| Time (UTC) | API 5xx rate (%) | p95 latency (ms) | Auth success (%) | Plaid refresh errorCount | reconnectRequiredItems delta | Reminder write success (%) | Webhook success (%) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T+0 |  |  |  |  |  |  |  |  |
| T+10 |  |  |  |  |  |  |  |  |
| T+20 |  |  |  |  |  |  |  |  |
| T+30 |  |  |  |  |  |  |  |  |
| T+45 (optional) |  |  |  |  |  |  |  |  |
| T+60 (optional) |  |  |  |  |  |  |  |  |

## 3) Alert Thresholds / Auto-Fail Triggers

Mark each threshold status: `OK`, `WARN`, or `FAIL`.

- API availability:
  - Threshold: any sustained 5xx on auth/plaid/cron routes for >5 min = `FAIL`
  - Status: `<OK|WARN|FAIL>`
- Plaid refresh health:
  - Threshold: `errorCount > 0` = `WARN`; `>=20%` item-level errors = `FAIL`
  - Status: `<OK|WARN|FAIL>`
- Reauth churn:
  - Threshold: unexpected increase in `reconnectRequiredItems` for healthy cohort = `FAIL`
  - Status: `<OK|WARN|FAIL>`
- Auth/session integrity:
  - Threshold: auth success <100% for canary cohort = `WARN`; repeated failures = `FAIL`
  - Status: `<OK|WARN|FAIL>`
- Reminder preference integrity:
  - Threshold: read/write mismatch on preference updates = `FAIL`
  - Status: `<OK|WARN|FAIL>`
- Webhook processing (if enabled):
  - Threshold: non-2xx or invalid ack payload = `WARN`; repeated failures = `FAIL`
  - Status: `<OK|WARN|FAIL|N/A>`

## 4) Escalation Contacts

- Incident commander (primary): `<name>` - `<channel/phone>`
- Engineering on-call (secondary): `<name>` - `<channel/phone>`
- QA/release observer: `<name>` - `<channel/phone>`
- Product/launch approver: `<name>` - `<channel/phone>`

Escalation policy:
- Any `FAIL` threshold: page incident commander immediately and open rollback bridge.
- Any `WARN` persisting >10 minutes: notify secondary + QA observer and prepare rollback.

## 5) Canary Findings

- Key observations:
  - `<observation 1>`
  - `<observation 2>`
- Incidents/anomalies:
  - `<none or details>`
- Mitigations applied during canary:
  - `<none or details>`
- Follow-up tickets created:
  - `<ticket links>`

## 6) Go / No-Go Signoff

- Final decision: `<GO|NO-GO>`
- Decision time (UTC): `<timestamp>`
- Rollback executed: `<YES|NO>`
- Decision rationale (1-3 bullets):
  - `<reason 1>`
  - `<reason 2>`

Required signoffs:
- Release owner: `<name>` - `<approved/rejected>` - `<time>`
- QA observer: `<name>` - `<approved/rejected>` - `<time>`
- Product/launch approver: `<name>` - `<approved/rejected>` - `<time>`

## 7) Evidence Links

- Runbook used: [launch-canary-rollback-runbook.md](./launch-canary-rollback-runbook.md)
- Verification log artifact: `<link/path>`
- Dashboard snapshot(s): `<link/path>`
- Incident thread (if any): `<link/path>`
