-- P0 fix: gateway processor secrets must not be readable by merchant staff.
--
-- Before this migration, `merchant_payment_gateways.config` held both secret
-- credentials (Stripe `secretKey`, Square `accessToken`, etc.) AND non-secret
-- device/account identifiers; RLS allowed any active merchant member to SELECT
-- the entire row, including secrets. A cashier could exfiltrate live keys.
--
-- This migration splits the surface:
--   * `config`        — keeps the FULL gateway configuration (secrets + ids).
--                       Read-only to service_role and server-side code paths;
--                       UPDATE only via platform-admin server actions.
--   * `public_config` — the non-secret subset (device id, env, UPI VPA, etc.)
--                       safe to expose to merchant staff for in-app rendering
--                       (e.g. UPI QR, default-gateway detection).
--
-- We keep `config` populated so the server-side terminal adapters in
-- /api/payments/start (service_role) continue to work unchanged. Member reads
-- are switched to `public_config`. The platform-admin GatewayEditor moves to
-- a server action that writes both columns.

alter table public.merchant_payment_gateways
  add column if not exists public_config jsonb not null default '{}'::jsonb;

-- Per-provider backfill of public_config from the existing `config` blob.
-- Keys here mirror the non-secret fields declared in packages/payments/src/registry.ts.
update public.merchant_payment_gateways set public_config = coalesce(
  case provider
    when 'cash' then '{}'::jsonb
    when 'stripe' then jsonb_strip_nulls(jsonb_build_object(
      'readerId', config->>'readerId'
    ))
    when 'square' then jsonb_strip_nulls(jsonb_build_object(
      'locationId', config->>'locationId',
      'deviceId', config->>'deviceId',
      'environment', config->>'environment'
    ))
    when 'paypal' then jsonb_strip_nulls(jsonb_build_object(
      'clientId', config->>'clientId',
      'environment', config->>'environment'
    ))
    when 'adyen' then jsonb_strip_nulls(jsonb_build_object(
      'merchantAccount', config->>'merchantAccount',
      'poiId', config->>'poiId',
      'environment', config->>'environment'
    ))
    when 'authorizenet' then jsonb_strip_nulls(jsonb_build_object(
      'apiLoginId', config->>'apiLoginId'
    ))
    when 'clover' then jsonb_strip_nulls(jsonb_build_object(
      'merchantId', config->>'merchantId',
      'deviceId', config->>'deviceId',
      'environment', config->>'environment'
    ))
    when 'valor' then jsonb_strip_nulls(jsonb_build_object(
      'apiBase', config->>'apiBase',
      'epi', config->>'epi'
    ))
    when 'upi' then jsonb_strip_nulls(jsonb_build_object(
      'upiVpa', config->>'upiVpa',
      'payeeName', config->>'payeeName',
      'qrImageUrl', config->>'qrImageUrl'
    ))
    else '{}'::jsonb
  end,
  '{}'::jsonb
) where public_config = '{}'::jsonb;

-- Column-level privileges. Members lose SELECT on the secret `config` column;
-- they keep SELECT on metadata and `public_config`. Service-role retains full
-- access (it also bypasses RLS, but we revoke + re-grant explicitly for clarity).
revoke all on public.merchant_payment_gateways from anon, authenticated;

-- anon: no access at all. Cashiers must be authenticated.
-- authenticated:
--   * SELECT: everything except the `config` (secrets) column.
--   * INSERT: full row is fine — RLS still requires owner/admin role via mpg_write,
--     and the only browser flows that write today set non-secret fields only (UPI).
--     Secret writes go through the platform-admin server action (service_role).
--   * UPDATE: only on the safe columns. Secret writes must go through service_role.
--   * DELETE: allowed (RLS still requires owner/admin or platform admin).
grant select (
  id,
  merchant_id,
  provider,
  enabled,
  is_default,
  public_config,
  created_at,
  updated_at
) on public.merchant_payment_gateways to authenticated;
grant insert on public.merchant_payment_gateways to authenticated;
grant update (enabled, is_default, public_config, updated_at) on public.merchant_payment_gateways to authenticated;
grant delete on public.merchant_payment_gateways to authenticated;

grant all on public.merchant_payment_gateways to service_role;
