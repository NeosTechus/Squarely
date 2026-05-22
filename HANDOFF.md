# HANDOFF — Squarely

> **For the next Claude Code agent (or human dev) picking this up.**
> Read this file first. It contains the full conversation context, the decisions, what's built, and the exact next steps so you can continue without re-deriving anything.

---

## 1. What this project is

**Squarely** is a brand-new, multi-tenant SaaS POS / Kiosk / KDS app — a Square competitor — owned by the user (harshakolla). The user already runs a real production POS for "Fenton Gyro" at `/Users/harshakolla/NeosTechus.com/Projects/Live/fenton-gyro-elegance` (Vite + React + Firebase + Valor Connect + Epson LAN printing). Squarely is **not** derived from that repo — it's a fresh start that mirrors the *concepts* proven there at a much larger scope (multi-tenant, multi-app, store-ready).

**Goal**: ship a native mobile app (iOS + Android) merchants download, onboard a store, pick a plan, and run their whole business from one screen. Companion web admin for back-office. Marketing site for app downloads + signup.

---

## 2. Locked decisions (do not re-litigate without asking the user)

| Area | Decision | Why |
|---|---|---|
| Mobile stack | **Expo (React Native) + TypeScript + Expo Router + NativeWind** | Best enterprise-grade RN stack, code reuse with web, EAS for store submission, dev-client for native hardware modules |
| Web admin + marketing | **Next.js 16 App Router on Vercel** | User already deploys to Vercel; matches existing skill set |
| Backend | **Supabase (Postgres + RLS + Realtime + Auth + Storage + Edge Functions)** | Real ACID Postgres for money/inventory, RLS for multi-tenant isolation, SQL for reports, scales |
| Monorepo | **Turborepo + pnpm workspaces** | Industry standard, fast caching |
| Tenancy | **Multi-tenant SaaS from day one** | Every business row carries `merchant_id`, RLS enforces isolation via `active_merchant_id` JWT claim |
| Subscription billing | **Stripe Billing (web) + RevenueCat (mobile IAP)** | RevenueCat satisfies Apple/Google IAP requirements without forcing Reader-app status |
| Payments adapter | **Valor first (port from Fenton), then Stripe Terminal + Square Reader as drop-ins** | `PaymentProvider` interface in `packages/payments/src/provider.ts` |
| Hardware | Epson LAN ePOS, Valor card reader, camera + Bluetooth barcode scanners, cash drawer via Epson DK port | All carried over conceptually from Fenton repo |
| App surfaces | **One Expo binary, four boot modes**: POS / Kiosk / KDS / Admin. User picks at first launch (`apps/mobile/app/(boot)/index.tsx`). Plan + role gate which are available. | Like Square Register vs. Square Kiosk vs. Square KDS — one codebase |
| MVP scope | POS, Kiosk, Inventory, Customers/loyalty/orders, KDS, Admin | All four user-selected MVP areas + KDS + Admin |
| Repo path | `/Users/harshakolla/NeosTechus.com/Projects/Live/squarely` (sibling of fenton-gyro-elegance) | Confirmed by user |
| Repo name | `squarely` (placeholder — user can rebrand) | Sibling of fenton-gyro-elegance |

---

## 3. What's already built (Phase 0 — scaffold)

**Status**: 164 files, 4,914 lines, committed as `a016453` on `main`. No remote yet.

```
squarely/
├── apps/
│   ├── mobile/        Expo + Expo Router + NativeWind, boot-mode picker
│   ├── web-admin/     Next.js 16 App Router merchant back-office
│   └── marketing/     Next.js 16 marketing site + pricing + app download
├── packages/
│   ├── types/         Zod schemas (merchant, plan, item, order, payment, device, customer)
│   ├── db/            Supabase clients (browser, server, service-role)
│   ├── auth/          Multi-tenant session + active-merchant claim
│   ├── api-client/    TanStack Query hooks + pricing engine
│   ├── payments/      PaymentProvider interface + Valor adapter
│   ├── printing/      Epson ePOS XML + LAN dispatch + cloud fallback
│   ├── billing/       Stripe Checkout + Customer Portal helpers
│   ├── feature-flags/ Plan-tier feature gating
│   ├── ui-mobile/     NativeWind primitives (Button, Card, ScreenContainer)
│   ├── ui-web/        shadcn-style web primitives (Button, cn)
│   └── config/        Shared tsconfig/eslint/tailwind preset
├── supabase/
│   ├── migrations/20260515000000_init.sql   Full multi-tenant schema with RLS
│   ├── functions/                            8 Edge Functions
│   ├── seed.sql                              Plan tiers
│   └── config.toml
├── HANDOFF.md         ← you are here
├── README.md          Product-facing docs
├── package.json       Root scripts (turbo run ...)
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .env.example       Template for Supabase / Stripe / Valor / RevenueCat keys
└── .gitignore
```

### What works conceptually but has NOT been installed/run

- **`pnpm install` has not been run.** No `node_modules`. No lockfile. The very first thing to do is run it.
- **Supabase has not been initialized.** No local Postgres running. No remote project created.
- **Stripe / RevenueCat / EAS project IDs are placeholders** in `.env.example` and `apps/mobile/app.config.ts`.
- **Mobile assets** (`apps/mobile/assets/icon.png`, `splash.png`, `adaptive-icon.png`) are referenced but the files don't exist yet — Expo will use defaults until you add them.
- **Generated Supabase types** at `packages/db/src/types.ts` is a placeholder — run `pnpm --filter @squarely/db gen-types` once Supabase is running.

### Phase 0 deliberately stopped before any package install or external service setup

The scaffold is meant to be reviewable in isolation. Running `pnpm install` will pull ~2 GB of node_modules.

---

## 4. Where the user is in the build (current phase: end of Phase 0)

The implementation plan is in 7 phases (see [.claude/plans/i-wn-to-make-adaptive-teacup.md](/Users/harshakolla/.claude/plans/i-wn-to-make-adaptive-teacup.md) on the user's machine):

| Phase | Description | Status |
|---|---|---|
| **0** | Scaffold monorepo + apps + packages + Supabase folder | ✅ DONE (committed `a016453`) |
| 1 | Auth + multi-tenant foundation (Supabase Auth, merchants table, RLS, merchant-create wizard) | ⏭️ Next |
| 2 | Catalog + POS on mobile (items/categories/modifiers CRUD, POS register screen, Valor integration, order creation) | Pending |
| 3 | Printing + cash drawer (`packages/printing` LAN + cloud fallback, printer registration in admin) | Pending |
| 4 | Kiosk + KDS screens (6-step kiosk flow, real-time KDS) | Pending |
| 5 | Customers + loyalty + inventory tracking | Pending |
| 6 | Billing (Stripe Checkout, RevenueCat paywall, feature gates enforced server-side) | Pending |
| 7 | App Store + Play Store submission via EAS | Pending |

The user has answered every architectural question; **you do not need to re-ask anything from Phases 1–7 unless something concrete changes**.

---

## 5. What's loaded in the codebase from previous conversation

When porting *concepts* from the Fenton repo, these are the proven patterns to mirror:

| From Fenton repo (`/Users/harshakolla/NeosTechus.com/Projects/Live/fenton-gyro-elegance`) | Already mirrored in Squarely as | Notes |
|---|---|---|
| `src/data/menu.ts` (modifier shape, allergens, posOnly flag) | `packages/types/src/item.ts` | Schema matches |
| `src/data/orders.ts` (source/order_type/status/payment enums) | `packages/types/src/order.ts` + `supabase/migrations/...init.sql` enums | 1:1 |
| `api/_lib/receipt-xml.ts` (ePOS-Print SOAP builder) | `packages/printing/src/xml.ts` | Generalized over per-merchant header + cash drawer pulse |
| `src/lib/print-direct.ts` (direct LAN POST) | `packages/printing/src/lan.ts` | |
| `api/print/epson.ts` (cloud poll/ack fallback) | `supabase/functions/print-dispatch/index.ts` | |
| `api/valor-terminal-*.ts` + `src/lib/valor.ts` | `supabase/functions/valor-*` + `packages/payments/src/valor.ts` | Full flow |
| `src/lib/valor-epi.ts` (EPI registry) | `terminals` table + `packages/payments/src/provider.ts` | Pluggable provider interface |
| `src/lib/roles.ts` | `merchant_members.role` + `packages/auth/src/index.ts` | Richer role matrix: owner/admin/manager/cashier/kitchen/viewer |
| `firestore.rules` (auth/validation rules) | RLS policies in init migration | All enum validations carry over |

When you need to look at how Fenton solved a problem, read those exact files in the Fenton repo — they're battle-tested in production.

---

## 6. Continuing this conversation — the first thing to do

When the user comes back, the **next concrete action** is one of these (ask the user which):

### Option A — Install dependencies and verify everything builds
```bash
cd /Users/harshakolla/NeosTechus.com/Projects/Live/squarely
pnpm install                              # ~few minutes, ~2 GB
pnpm typecheck                            # all packages + apps must pass
pnpm lint
```
If anything fails, fix the import / config issue (most likely candidates: pnpm version mismatch, RN/Expo peer-dep conflicts, Next.js 16 + React 18 alignment). Then commit `chore: install dependencies and pass typecheck`.

### Option B — Push to GitHub
```bash
cd /Users/harshakolla/NeosTechus.com/Projects/Live/squarely
gh repo create squarely --private --source=. --remote=origin --push
```

### Option C — Start Phase 1 (multi-tenant auth + merchant onboarding)
The minimum useful slice:
1. Create a real Supabase project (or `supabase start` locally — `brew install supabase/tap/supabase` if missing).
2. Run `supabase db reset` to apply the init migration + seed.
3. Wire real Supabase Auth in `apps/web-admin/app/(auth)/login/page.tsx` (currently a form stub) — magic link first.
4. Build the merchant-create wizard at `apps/web-admin/app/(auth)/onboarding/page.tsx` — currently just shows the steps as text.
5. Implement the `set_active_merchant` RPC call after login (helper already exists in `packages/auth/src/index.ts`).
6. Test RLS by creating two merchants and confirming cross-merchant SELECT returns zero rows.

### Option D — Add more payment gateway adapters
The user asked about MCP-style adapters for payment gateways. Recommended next adapters:
- **Stripe Terminal** (Tap-to-Pay on iOS/Android = no extra hardware) — highest ROI
- **Square Reader** — converts Square merchants
- Skeleton files go in `packages/payments/src/{stripe-terminal,square,adyen,clover}.ts` and add provider values to `terminals.provider` enum in a new migration.

### Option E — Implement the kiosk 6-step flow or KDS realtime
Currently `apps/mobile/app/(kiosk)/index.tsx` is just a welcome screen. The user explicitly wants a Square-Kiosk-style customer ordering flow (the Fenton repo's `src/pages/KioskPage.tsx` has the full 6-step pattern to mirror).

**If unsure which option, ask the user.** Do not start large work without confirmation.

---

## 7. Hard rules / preferences the user has established

- **Do not run `pnpm install` or any long-running command without first announcing it.** It will burn ~2 GB and a few minutes.
- **Do not push to GitHub without explicit confirmation.** The user said "ask first" for risky/visible actions.
- **Do not introduce new architectural decisions** (different DB, different RN framework, different billing) without surfacing the question. Everything in §2 is locked.
- **Edit existing files; do not create new docs unless asked.** The user explicitly asked for this HANDOFF, so this file is fine. Do NOT proactively spawn ARCHITECTURE.md, ROADMAP.md, CONTRIBUTING.md, etc.
- **Match the user's typing style in casual conversation** — they type fast with typos. Do not correct them. Just interpret intent.
- **The user prefers terse responses with sentence-level updates between tool calls, not paragraphs.**
- **When in plan mode**, use the ExitPlanMode tool only after the plan file is written and ready for approval. Don't ask "is this ok?" via text.

---

## 8. Open questions from the previous conversation

Two remain (user agreed to "decide as we go"):

1. **Tamagui vs NativeWind** — currently scaffolded with NativeWind. Spike Tamagui in Phase 0.5 if richer cross-platform primitives become important. Not blocking.
2. **Drizzle on top of Supabase** — recommendation is yes (typesafe queries). Decide before Phase 2 catalog CRUD. If yes, add `packages/db/src/schema/` and wire `drizzle-orm`.

Final brand name (squarely is a placeholder) is also user's call — does not block any technical work.

---

## 9. Environment notes

- **macOS** (darwin 23.5.0), zsh, Node 20.19, pnpm 10.4.1, git 2.39.
- **Supabase CLI**: NOT installed yet — `brew install supabase/tap/supabase`
- **EAS CLI**: NOT installed yet — `npm i -g eas-cli`
- **Vercel CLI**: outdated (53.2.0; upgrade with `npm i -g vercel@latest`) — only matters when deploying.
- **Fenton repo is on `main` with one uncommitted untracked folder (`scripts/`)** — don't touch it; out of scope for Squarely.

---

## 10. Quick reference — important file paths

**Plan**: `/Users/harshakolla/.claude/plans/i-wn-to-make-adaptive-teacup.md` (the source-of-truth strategy doc)

**Core types**: [packages/types/src/](packages/types/src/)
- `merchant.ts` — Merchant, MerchantMember, MerchantRole
- `plan.ts` — Plan, Subscription, PLAN_FEATURES, PLAN_DEVICE_LIMITS
- `item.ts` — Item, Category, ModifierGroup, ModifierOption, Allergen
- `order.ts` — Order, OrderItem, OrderSource, OrderType, OrderStatus
- `payment.ts` — Payment, PaymentEvent, PublishSaleInput
- `device.ts` — Device, Terminal, Printer, Location, BootMode

**Migration**: [supabase/migrations/20260515000000_init.sql](supabase/migrations/20260515000000_init.sql) — all tables, enums, RLS, helpers

**Boot-mode picker** (the centerpiece of "one app, all dashboards"): [apps/mobile/app/(boot)/index.tsx](apps/mobile/app/(boot)/index.tsx)

**Payment provider interface**: [packages/payments/src/provider.ts](packages/payments/src/provider.ts)

**Receipt builder**: [packages/printing/src/xml.ts](packages/printing/src/xml.ts)

**Pricing engine**: [packages/api-client/src/pricing.ts](packages/api-client/src/pricing.ts)

**Plan feature matrix**: [packages/feature-flags/src/index.ts](packages/feature-flags/src/index.ts)

---

## TL;DR for the agent reading this

1. Read §2 (locked decisions). Don't re-ask.
2. Look at §3 (what's built) and §6 (what's next).
3. Ask the user which of Option A/B/C/D/E they want next — do NOT pick on your own.
4. Keep responses terse. Respect the rules in §7.
5. The Fenton repo at `../fenton-gyro-elegance` is the reference implementation for any feature you're unsure how to design.
