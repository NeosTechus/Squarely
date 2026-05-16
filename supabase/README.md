# Supabase

This folder contains the database schema, RLS policies, seed data, and Edge Functions for Squarely.

## Local dev

```bash
# One-time
brew install supabase/tap/supabase

# Boot a local Postgres + Auth + Studio
supabase start

# Apply migrations + seed
supabase db reset

# Studio UI
open http://127.0.0.1:54323
```

After `supabase start` you'll get local URL + anon/service keys. Paste them into the root `.env.local`.

## Migrations

- `20260515000000_init.sql` — full multi-tenant schema with RLS, enums, helpers (`active_merchant_id()`, `is_member_of()`, `has_role()`), and per-merchant order numbering.

## Edge Functions

- `valor-publish` — start a card sale on a Valor terminal.
- `valor-status` — poll for transaction outcome.
- `valor-cancel` — cancel a pending sale.
- `valor-webhook` — receive Valor's async callback, write `payments` + flip `orders.payment_status`.
- `print-dispatch` — Epson SDP poll/ack: serves queued ePOS XML to the printer's cloud poll loop and marks `receipts.printed_at` on ack.
- `stripe-webhook` — sync Stripe subscription lifecycle into `subscriptions`.
- `revenuecat-webhook` — sync mobile IAP entitlements into `subscriptions`.
- `loyalty-accrue` — grant points on `order_paid`.

Deploy:

```bash
supabase functions deploy valor-publish
supabase functions deploy valor-status
supabase functions deploy valor-cancel
supabase functions deploy valor-webhook
supabase functions deploy print-dispatch
supabase functions deploy stripe-webhook
supabase functions deploy revenuecat-webhook
supabase functions deploy loyalty-accrue
```

Secrets:

```bash
supabase secrets set VALOR_API_KEY=... VALOR_API_BASE=...
supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...
supabase secrets set REVENUECAT_WEBHOOK_TOKEN=...
```

## After schema changes

Regenerate TypeScript types for the shared client:

```bash
pnpm --filter @squarely/db gen-types
```
