-- Extra per-merchant checkout feature toggles for the super-admin console.
-- All default true so existing tenants keep their current behavior on migration.
-- Idempotent: safe to re-run; the NOT NULL DEFAULT also means no backfill is required.
alter table public.merchant_features
  add column if not exists tips_enabled boolean not null default true;
alter table public.merchant_features
  add column if not exists modifiers_enabled boolean not null default true;
alter table public.merchant_features
  add column if not exists open_tabs_enabled boolean not null default true;

comment on column public.merchant_features.tips_enabled is
  'Show tip prompt at checkout (POS + Kiosk).';
comment on column public.merchant_features.modifiers_enabled is
  'Allow item modifier selection at checkout (opens the modifier sheet for items with modifier_group_ids).';
comment on column public.merchant_features.open_tabs_enabled is
  'Show the Open orders / pay-at-counter queue on POS (kiosk-settlement flow).';
