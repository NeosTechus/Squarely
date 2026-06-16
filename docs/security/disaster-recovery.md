# Disaster Recovery — Squarely

> Owner: Platform team · Last updated: 2026-06-15 · Review cadence: quarterly

This document declares Squarely's recovery posture for the data and
infrastructure that back the multi-tenant POS. It exists so that on-call has
something to follow at 3am, and so enterprise prospects asking for our DR
posture get a defensible answer instead of a shrug.

The audit on 2026-06-15 (`Squirley wmnq4xory`) flagged the lack of a declared
RPO/RTO as a critical gap. This file closes that gap; the operational targets
below are aspirational until the supporting work (PITR confirmation, quarterly
drill, status page) is done — items marked **[OPEN]**.

---

## 1. Targets

| Metric | Target | Notes |
|---|---|---|
| **RPO** (data loss tolerated) | ≤ 5 minutes | Achievable via Supabase Pro/Team PITR (point-in-time recovery) which runs continuous WAL archiving. |
| **RTO** (time to restore) | ≤ 1 hour for full DB; ≤ 15 min for app code | App is stateless on Vercel — `vercel rollback` is the recovery primitive. DB restore depends on Supabase tier. |
| **Backup retention** | ≥ 14 days | Supabase Pro = 7 days PITR, Team = 14 days. **[OPEN] confirm tier**. |
| **DR drill cadence** | Quarterly | Restore prod snapshot into a sandbox project, run smoke + tenant-export. **[OPEN] schedule first drill**. |

---

## 2. The asset map

| Asset | Provider | Persistence | Recovery primitive |
|---|---|---|---|
| Postgres (all tenant data, RLS, RPCs, audit log) | Supabase | continuous WAL | PITR restore via Supabase dashboard |
| Auth users + sessions | Supabase Auth | continuous | included in PITR |
| Receipt emails | Resend | no first-party retention needed; provider has own log retention | re-send from `orders` if the message was lost |
| SMS receipts | Twilio | provider message log | n/a (transient) |
| Payment processor records | Stripe / Square / Adyen / Clover / Authorize.Net / PayPal / Valor | provider-side, never first-party | reconcile from gateway dashboards if our `orders.gateway_payment_id` survives |
| Web/app code | Vercel | git + Vercel deploys | `vercel rollback` to a known-good deployment |
| Mobile app code | EAS / Play Store / App Store | EAS builds + OTA bundles | revert via `eas update --branch` or re-upload last AAB |
| Cert-pin SPKI hashes | git (`apps/mobile/cert-pinning/network_security_config.xml`) | committed | see `docs/security/mobile-cert-pinning.md` |
| Processor secrets | Supabase `merchant_payment_gateways.config` JSONB | continuous | rotate per merchant via `/admin/clients/[id]` |
| LAN printer agent credentials | operator-managed `.env` on venue host | none | re-issue and re-config locally |

---

## 3. Threat scenarios + response

### 3.1 Single bad migration applied to prod

**Detection signal:** unexpected app-level errors on routes that touch the affected tables; Sentry alert (see `alerting.md` — **[OPEN]**); operator manual report.

**Immediate actions:**
1. Freeze new migrations: stop the next CI deploy by reverting the migration PR or marking the branch `do-not-merge`.
2. Confirm the migration is reversible by SQL (most of ours are: `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`).
3. If reversible: write an inverse migration, paste-deploy via the Supabase dashboard.
4. If NOT reversible (data loss / column drop / type narrowing): trigger PITR clone (step 3.4 below).

**Post-mortem template:** what was the migration, why didn't CI / migration linting catch it, what guard is added.

---

### 3.2 Supabase regional outage

**Detection signal:** Supabase status page red; widespread 5xx on `/api/*`; mobile clients stuck on "loading".

**Immediate actions:**
1. Acknowledge on the status page (**[OPEN] provision** statuspage.io / instatus / Vercel statuspage).
2. Wait for Supabase to recover — we do not run a hot-standby in another region. (RTO ~ Supabase's regional incident response.)
3. Communicate to merchants: receipts/refunds/login unavailable, in-store cash transactions still work but won't ring through Squarely until DB recovers.
4. After recovery: dump any locally-queued mobile orders that buffered, confirm `create_order_with_items` idempotency took effect.

**Future work:** multi-region read replica + readable-during-outage degraded mode. Not in scope for v1.

---

### 3.3 Vercel / web-admin outage

**Detection signal:** Vercel status page red; web-admin returns 5xx; mobile app `/api/*` calls fail but Supabase Realtime still works.

**Immediate actions:**
1. Confirm via Vercel status page that the platform itself is degraded (vs. our deployment).
2. Mobile POS continues to function for purely-Supabase flows (order writes via the SECURITY DEFINER RPC, RLS-read paths). Email/SMS/print receipts that route through `/api/*` will fail — degrade gracefully.
3. If our deployment alone is broken: `vercel rollback` to the previous known-good production deployment (RTO ~ 60 seconds).

---

### 3.4 PITR restore (full data loss / catastrophic corruption)

**When to use:** schema dropped, mass row deletion, RLS misconfiguration leaking cross-tenant data, ransomware-style writes to large parts of the database.

**Steps:**
1. **STOP all writes.** In Supabase dashboard, disable the project's API (or rotate the service-role key and don't re-deploy).
2. Identify the last good timestamp before the incident (audit log + Sentry should narrow this).
3. In Supabase dashboard → Project → Database → Backups → Point-in-time → enter timestamp → restore to a **new project** (PITR clones to a sibling project; the source stays available for forensics).
4. Validate the restored project: spot-check `merchants`, `orders`, `admin_audit` for known-good rows.
5. Repoint env vars `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel (squarely-admin) to the new project. Trigger redeploy.
6. Re-enable mobile clients (no change required — they hit the same admin host).
7. Communicate to merchants the window of writes lost (everything between the PITR timestamp and the incident).

**Expected RTO:** 30–60 minutes. **Expected RPO:** ≤ 5 min if the incident timestamp can be pinned down precisely; up to PITR resolution otherwise.

---

### 3.5 Per-tenant data corruption (a single merchant's data is wrong)

**When to use:** a merchant reports lost orders / wrong totals / missing items after a customer-side bug.

**Steps:**
1. PITR clone to a sandbox project (step 3.4 above without the repoint).
2. From the sandbox, extract the affected merchant's rows: `select * from orders where merchant_id = ?`, plus joined `order_items`, `receipts`, `payments`.
3. Surgical apply: paste a transactional SQL block into prod that re-inserts the lost rows. Use the existing `admin_audit` to log the operator.
4. Discard the sandbox project.

---

### 3.6 Cert-pin emergency (live apps broken in production)

See `mobile-cert-pinning.md` § "Emergency rotation." Summary: OTA cannot
recover from broken native pins — only a new EAS build pushed to Play /
App Store. The bridge while users wait for the update is **degrade pins to
warn-only** via `EXPO_BUILD_ALLOW_PLACEHOLDER_PINS=1` in the next EAS build,
or `app-bundle` re-upload with the new SPKI hashes.

---

### 3.7 Processor secret leak (`merchant_payment_gateways.config`)

**When to use:** suspected leak of one or more merchants' Stripe / Square / Adyen credentials from a backup, a misconfigured query, or a compromised platform-admin session.

**Steps:**
1. Identify the affected merchant(s) from `admin_audit` (look for `saveMerchantGateway` writes in the suspect window, plus any anomalous reads).
2. In each affected processor's dashboard, rotate / revoke the leaked credential immediately (Stripe restricted keys → revoke; Square → re-issue access token; Adyen → revoke API key).
3. The affected merchant must paste in new credentials via `/admin/clients/[id]` → Gateways panel.
4. `config_version` on `merchant_payment_gateways` enforces ≤ 60-day age, which limits steady-state blast radius. Use this incident to flush all merchants past their rotation window.
5. Notify the affected merchant within 72 hours per GDPR / state breach-notification SLAs.

---

## 4. Pre-incident checklist (what we own to keep DR honest)

- [ ] **[OPEN]** Confirm and document our Supabase tier (Pro/Team/Enterprise) and the PITR retention window it gives us. Paste the confirmation into this section.
- [ ] **[OPEN]** Schedule the first quarterly DR drill: PITR-clone prod to a sandbox project, validate the sandbox, then destroy. Block 2 hours on a calendar. Capture the actual restore time observed; if > 60 min, escalate the DR target.
- [ ] **[OPEN]** Provision a public status page (statuspage.io / instatus / Vercel statuspage) and link it from the marketing site footer.
- [ ] **[OPEN]** Provision a paging tool (Sentry Alerts → PagerDuty / Opsgenie / a Slack webhook). Wire the four alert rules from `alerting.md` (refund 5xx, webhook 5xx, payments 502, stuck print_jobs).
- [ ] **[OPEN]** Document the on-call rotation: who is primary, who is backup, weekly handoff time, escalation path. Currently undocumented.
- [ ] **[OPEN]** Add a per-tenant export job (`select_all_for_merchant(uuid)` SECURITY DEFINER RPC + a CSV-bundle writer) so a merchant exit / GDPR request doesn't require ad-hoc SQL.
- [ ] **[OPEN]** Capture a snapshot of secrets-rotation cadence in `secrets-rotation.md` and link it from this file.

---

## 5. Out of scope (deliberately)

- **Multi-region active-active.** Not justified at our scale; would double Supabase cost and create a CAP-theorem distraction for a single-currency-write workload.
- **Daily cold backups.** PITR is strictly better (continuous WAL); a daily snapshot adds storage cost without recovery benefit.
- **Air-gapped backup copy.** Considered overkill until we have enterprise customers with explicit contractual requirements.

---

## 6. References

- Supabase PITR docs: https://supabase.com/docs/guides/platform/backups
- `docs/security/mobile-cert-pinning.md` — companion runbook for cert-pin emergencies
- `docs/security/secrets-rotation.md` — companion runbook for credential rotation
- `docs/security/alerting.md` — **[OPEN]** companion runbook for paging thresholds
