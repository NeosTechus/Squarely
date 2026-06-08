-- Key versioning on merchant_payment_gateways.
-- Lets us track when a merchant's processor secret was last rotated so the
-- platform-admin UI can surface "Last rotated: X days ago" and so we can
-- enforce a 90-day rotation policy programmatically.
--
-- Idempotent: column adds use IF NOT EXISTS; backfill is gated on
-- `config_rotated_at is null`; grants are idempotent. Safe to re-run.

alter table public.merchant_payment_gateways
  add column if not exists config_version int not null default 1;

alter table public.merchant_payment_gateways
  add column if not exists config_rotated_at timestamptz;

-- Backfill: assume existing rows were last rotated at their updated_at.
-- Only fills nulls, so re-running the migration is a no-op.
update public.merchant_payment_gateways
   set config_rotated_at = updated_at
 where config_rotated_at is null;

-- Extend the authenticated SELECT column grant to include the new
-- non-secret rotation-tracking columns. The previous migration
-- (20260606000000) revoked all and re-granted a specific column list;
-- we widen that list here. SELECT on `config` (secret) remains denied.
grant select (
  id,
  merchant_id,
  provider,
  enabled,
  is_default,
  public_config,
  config_version,
  config_rotated_at,
  created_at,
  updated_at
) on public.merchant_payment_gateways to authenticated;

-- Deliberately NOT granted on UPDATE: only the platform-admin server
-- action (service_role) may bump these columns. service_role retains
-- full access via the prior `grant all ... to service_role`.
