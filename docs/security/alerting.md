# Alerting — Squarely

> Owner: Platform team · Last updated: 2026-06-15 · Companion to `disaster-recovery.md`

Audit `wmnq4xory` (2026-06-15) flagged the absence of any threshold alerting
on real-money routes as critical. This document specifies the alerts that
must exist before a confident GA, in a provider-agnostic form so the team
can wire them to Sentry Alerts, Datadog Monitors, Grafana Cloud, or a Slack
webhook depending on what gets provisioned.

The alert RULES are committed here so they survive provider migrations and
are reviewable in PR. The alert DELIVERY (where they page) is provider-
specific and must be configured once in the chosen tool.

---

## 0. Prerequisites — **[OPEN]**

- [ ] Install an error tracker. Recommended: `@sentry/nextjs` in `apps/web-admin` and `@sentry/react-native` in `apps/mobile`. Wire DSN into Vercel env (`SENTRY_DSN`, `SENTRY_AUTH_TOKEN`) and EAS secret (`SENTRY_DSN`).
- [ ] Replace every `console.error([...], e)` in the 6+ money-handling routes with `Sentry.captureException(e, { tags, extra })`. Keep the `console.error` so Vercel function logs still show the failure in-line.
- [ ] Provision a paging channel: PagerDuty, Opsgenie, or a high-noise Slack channel that ops actually watches.
- [ ] Document the on-call rotation in `disaster-recovery.md` § 4.

---

## 1. The alerts

Each alert below is specified as: **signal · threshold · severity · runbook**.

### A1 — Refund route 5xx burst

- **Signal**: count of `POST /api/refunds` responses with status ≥ 500, OR exceptions captured from `apps/web-admin/app/api/refunds/route.ts`.
- **Threshold**: ≥ 2 in any 5-minute window.
- **Severity**: P1 — pages on-call within 5 min.
- **Why**: a refund failure leaves the customer money in limbo and the merchant's books out of sync with the gateway. Even one is worth eyeballing; two means a pattern.
- **Runbook**: `docs/security/disaster-recovery.md` § 3.7 (if it's a processor leak) or the post-mortem template. Triage by reading the captured exception — is it a gateway-side 502, a Supabase write fail, or our own logic?

### A2 — Stripe webhook signature / handler 5xx

- **Signal**: count of `POST /api/stripe-webhook` responses with status ≥ 400, OR exceptions captured from the handler.
- **Threshold**: ≥ 1 in any 10-minute window. **No noise budget** — Stripe webhooks should never fail.
- **Severity**: P1 — pages on-call within 10 min.
- **Why**: a webhook 5xx returns to Stripe → Stripe retries → if our handler is broken we silently lose subscription state changes. Also: signature failures are an attack signal, not a noise event.
- **Runbook**: check Vercel logs for the exception. If signature mismatch — confirm `STRIPE_WEBHOOK_SECRET` hasn't been rotated and lost from Vercel env. If handler exception — defer the upsert and bail with `received:true` only if the event is non-state-changing (see H2 idempotency work).

### A3 — Payments start route 5xx

- **Signal**: count of `POST /api/payments/start` responses with status ≥ 500.
- **Threshold**: ≥ 3 in any 5-minute window.
- **Severity**: P1 — pages on-call within 5 min.
- **Why**: the payment session can't be initiated → no order rings → every POS device in the field is degraded.
- **Runbook**: identify which gateway adapter is throwing (Stripe / Square / Adyen / etc.). If one specific gateway is regional-outage-degraded, communicate to affected merchants and degrade their gateway to a backup if configured.

### A4 — Print job queue stuck

- **Signal**: count of rows in `public.print_jobs` where `status = 'queued'` AND `created_at < now() - interval '60 minutes'`.
- **Threshold**: ≥ 1 row matching for ≥ 10 minutes.
- **Severity**: P2 — Slack notification within 30 min (not a pager wake-up).
- **Why**: the LAN printer agent has died or lost connectivity. Kitchen tickets are not printing; staff have manual fallback (handwritten) but service degrades fast.
- **Runbook**: `docs/security/disaster-recovery.md` § 3.6-equivalent for print agent failures. Contact the affected merchant; check whether the agent host is up and signed-in. The agent's auth is a long-lived session (see secrets-rotation.md), so most likely cause is host power-down or LAN partition.
- **Implementation**: a Vercel Cron at `/api/internal/check-stuck-prints` running every 5 min, querying the count, and emitting `Sentry.captureMessage` with a tag when threshold is exceeded. Alternatively a Supabase scheduled function. **[OPEN] both paths require Sentry install (A0).**

### A5 — Rate limit denial storm

- **Signal**: rate of 429s across `/api/*` routes.
- **Threshold**: ≥ 20 in any 1-minute window (across all routes summed).
- **Severity**: P2 — Slack notification.
- **Why**: either a misbehaving client (a POS device in a retry loop) or a credential-stuffing attack on an authenticated route (less likely given Bearer JWT requirement, but still worth flagging).
- **Runbook**: look at the userId distribution in the 429-emitting buckets. If one userId is hammering, contact the merchant; if a wide spread, suspect attack and elevate to P1.

### A6 — Receipts send 502 (Resend / Twilio down)

- **Signal**: count of `POST /api/receipts/email` OR `/api/receipts/sms` responses with status = 502.
- **Threshold**: ≥ 5 in any 5-minute window.
- **Severity**: P2 — Slack notification.
- **Why**: Resend or Twilio is provider-side degraded; the order itself completed (cash drawer is open / card was charged), only the receipt delivery failed. Customer-visible but not catastrophic. Distinct from A3 (which blocks the sale entirely).
- **Runbook**: confirm Resend / Twilio status page. If provider-side, communicate ETA via status page and let merchants know receipts are queued (note: currently we don't actually queue — failed receipts are lost — see follow-up below).

### A7 — Webhook signature mismatch (attack signal)

- **Signal**: count of `console.error` lines matching `[verifyWebhook:*]` indicating signature verification failure.
- **Threshold**: ≥ 5 in any 1-minute window.
- **Severity**: P1 — pages on-call within 5 min.
- **Why**: legitimate webhook signatures don't randomly fail. Sustained mismatch is either a misconfigured secret on our side OR an active probe attempt.
- **Runbook**: confirm webhook secrets in Vercel env match the provider dashboard. If they match — the source IP distribution should reveal whether one provider is leaking, or it's external probing (block via Vercel WAF).

---

## 2. Implementation order

1. Install Sentry per § 0.
2. Implement A1, A2, A3 first — these are the three real-money alerts. Wire them to a pager.
3. Implement A4, A6 — receipt + print delivery. Wire to Slack.
4. Implement A5, A7 — abuse signals. Wire to Slack initially, escalate to pager only after a baseline is established.

---

## 3. Suppression + maintenance windows

- Vercel deploys cause a transient 5xx blip — every alert above should ignore the 60s after a deploy event (Sentry supports this via "ignored during release window").
- Quarterly DR drills will trigger A2 (we'll deliberately fire a test webhook). Snooze A2 for the drill window before starting.

---

## 4. Out of scope (for now)

- **Latency / p95 alerts.** We don't have RUM and don't have a documented latency SLO yet. Add `@vercel/analytics` first; alerts come after a baseline.
- **Cost alerts** (Supabase egress, Resend send volume, Twilio segments). Useful but provider-side, not in our app code. Configure via the provider billing dashboard when there's a non-zero traffic baseline.
- **Synthetic monitoring** (a continuous mock-purchase that exercises POS → /api/payments/start → /api/receipts/email). Worth doing when we have a "preview tenant" sandbox; currently the cross-tenant fuzz tests cover this in CI but nothing exercises it on live infra.

---

## 5. Open follow-ups discovered while writing this

- **Receipt failure has no queue.** A failed `/api/receipts/email` is dropped after the 502 — the merchant has no way to retry from the dashboard. Either add a "Resend receipt" button on the orders detail page, OR write failed sends to a `receipt_send_failures` table that the dashboard surfaces. Not in scope for the 7-item sprint but worth noting.
- **`/admin/observability` is client-poll only.** Convert its widgets (stuck tickets, unpaid orders > 1h, dead-store check) into Sentry-side metric alerts so they survive without an admin logged in.

---

## 6. References

- Sentry Next.js setup: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- Sentry React Native setup: https://docs.sentry.io/platforms/react-native/
- `docs/security/disaster-recovery.md` — DR runbook (companion)
- `docs/security/secrets-rotation.md` — credential rotation runbook
- `docs/security/mobile-cert-pinning.md` — cert-pin emergency runbook
