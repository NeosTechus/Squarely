# Squarely

Enterprise multi-tenant POS / Kiosk / KDS SaaS — a Square replica.

## Stack

- **Mobile app** — Expo (React Native) + TypeScript + Expo Router + NativeWind
- **Web admin** — Next.js 16 (App Router) + Tailwind + shadcn/ui
- **Marketing site** — Next.js 16 (App Router)
- **Backend** — Supabase (Postgres + RLS + Realtime + Auth + Storage + Edge Functions)
- **Payments** — Valor Connect (current) via adapter pattern; Stripe Terminal / Square Reader as future drop-ins
- **Subscription billing** — Stripe Billing (web) + RevenueCat (mobile IAP)
- **Hardware** — Epson LAN ePOS receipt printer, cash drawer via DK port, camera + Bluetooth barcode scanners
- **Monorepo** — Turborepo + pnpm workspaces

## Repository layout

```
squarely/
├── apps/
│   ├── mobile/              # Expo RN app — POS, Kiosk, KDS, Admin (mode-switched)
│   ├── web-admin/           # Next.js merchant back-office
│   └── marketing/           # Next.js marketing site + download
├── packages/
│   ├── types/               # Shared Zod schemas + TS types
│   ├── db/                  # Supabase types + Drizzle schema
│   ├── api-client/          # TanStack Query hooks
│   ├── auth/                # Supabase Auth helpers + multi-tenant session
│   ├── ui-mobile/           # NativeWind + RN components
│   ├── ui-web/              # shadcn/ui re-exports
│   ├── payments/            # Valor adapter + PaymentProvider interface
│   ├── printing/            # Epson ePOS SOAP builder + LAN dispatcher
│   ├── billing/             # Stripe + RevenueCat plan/feature gating
│   ├── feature-flags/       # Plan-tier → feature map
│   └── config/              # eslint, tsconfig, tailwind preset
├── supabase/
│   ├── migrations/          # SQL migrations
│   ├── functions/           # Edge Functions (Valor, print dispatch, Stripe)
│   └── seed.sql
```

## Architecture at a glance

A new developer's mental model of how the pieces fit together:

```
                          ┌─────────────────────────────────────────┐
                          │            SQUARELY MONOREPO              │
                          │   (pnpm workspaces + Turborepo, TS)       │
                          └─────────────────────────────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        │                                 │                                 │
   ┌────▼─────┐                     ┌─────▼──────┐                    ┌──────▼──────┐
   │  apps/   │                     │ packages/  │                    │  supabase/  │
   │ (3 apps) │   ── import ──▶     │ (shared)   │   ◀── talk to ──   │  (backend)  │
   └────┬─────┘                     └─────┬──────┘                    └──────┬──────┘
        │                                 │                                  │
  ┌─────┴───────────┐         ┌───────────┴────────────┐          ┌──────────┴──────────┐
  │                 │         │                          │          │                     │
  ▼                 ▼         ▼                          ▼          ▼                     ▼

 MARKETING        WEB-ADMIN    MOBILE              SHARED LOGIC      DATABASE          EDGE FUNCTIONS
 (Next.js)        (Next.js)    (Expo/RN)           packages:        migrations/        functions/
 :3001            :3000        iOS+Android                          (Postgres+RLS)
                                                   • types   (Zod)
 Public site      Merchant     POS / Kiosk         • db      (Supabase clients)   ┌─ Valor (payments)
 landing/pricing  dashboard    KDS / Admin         • auth    (multi-tenant)       ├─ print-dispatch
                                                   • api-client (TanStack Query)   ├─ stripe-webhook
                                                   • payments  (Valor adapter)     └─ revenuecat-webhook
                                                   • printing  (Epson ePOS)
                                                   • billing   (Stripe)
                                                   • feature-flags (plan gating)
                                                   • ui-mobile  (NativeWind)
                                                   • ui-web     (shadcn-style)
                                                   • config     (shared presets)
```

### Request / data flow

```
  User action (web or mobile)
        │
        ▼
  App calls packages/api-client  ──▶ uses packages/db (Supabase client)
        │                                     │
        │                                     ▼
        │                          Supabase (Postgres + Auth)
        │                                     │
        │                          Row-Level Security checks:
        │                          "is this user a member of this merchant?"
        │                                     │
        ▼                                     ▼
  packages/auth resolves           Returns only that merchant's rows
  active_merchant_id from JWT      (multi-tenant isolation)
```

### Where to start

1. `pnpm install` → `pnpm dev` (starts the web apps).
2. Read `packages/types` first — the Zod schemas *are* the data model.
3. Then `supabase/migrations` — the actual DB shape + RLS security rules.
4. Then pick an app in `apps/` and follow its imports back into `packages/`.

## First-time setup

```bash
# Install dependencies
pnpm install

# Copy env template
cp .env.example .env.local
# Fill in your Supabase, Stripe, Valor keys

# Install required CLIs (one-time)
brew install supabase/tap/supabase
npm i -g eas-cli

# Start local Supabase
pnpm supabase:start

# Run everything in dev mode
pnpm dev
```

## Per-app dev commands

```bash
pnpm web:marketing       # marketing site on :3001
pnpm web:admin           # web admin on :3000
pnpm mobile:ios          # iOS simulator
pnpm mobile:android      # Android emulator
```

## Plan tiers (drives feature flags)

| Feature             | Starter | Growth | Pro | Enterprise |
| ------------------- | ------- | ------ | --- | ---------- |
| POS register        | ✓       | ✓      | ✓   | ✓          |
| Devices             | 1       | 3      | 10  | ∞          |
| Kiosk mode          | —       | ✓      | ✓   | ✓          |
| Inventory tracking  | basic   | ✓      | ✓   | ✓          |
| KDS                 | —       | —      | ✓   | ✓          |
| Loyalty             | —       | —      | ✓   | ✓          |
| Multi-location      | —       | —      | ✓   | ✓          |
| Advanced reports    | —       | —      | ✓   | ✓          |
| API access          | —       | —      | —   | ✓          |
| White-label         | —       | —      | —   | ✓          |

## Architecture notes

- **Multi-tenant from day one.** Every business row carries `merchant_id`. RLS enforces isolation. JWT carries the active merchant via custom claim.
- **One mobile binary, four boot modes.** After auth, the user picks POS / Kiosk / KDS / Admin. Plan + role gate which modes are available.
- **Direct-LAN printing first, cloud fallback.** Mobile app POSTs receipt ePOS XML straight to the printer over LAN. If unreachable, the receipt queues in Supabase and an Edge Function dispatches via the printer's cloud poll/ack endpoint.
- **Payments are pluggable.** `PaymentProvider` interface in `packages/payments`. Valor ships first; Stripe Terminal and Square Reader are drop-in replacements.
