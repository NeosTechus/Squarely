-- 20260606020000_tighten_anon_grants.sql
--
-- Tighten anon role privileges that were over-broad in earlier migrations
-- (notably the blanket grants in 20260518000000_platform_admin.sql and the
-- per-table/per-function grants in 20260519/20/28). Anon is never used by
-- any Squarely app surface to read or write data: apps/mobile and
-- apps/web-admin both sign in before any DB access, and apps/marketing does
-- not touch Supabase at all. This migration removes anon's DML on every
-- public table, anon's USAGE/SELECT on every public sequence, and anon's
-- EXECUTE on every public function, then re-grants EXECUTE on the single
-- function (public.is_platform_admin()) that RLS policies need anon to be
-- able to evaluate. Default privileges are also tightened so future objects
-- in the public schema do not silently re-open the hole. Authenticated and
-- service_role privileges are intentionally untouched -- RLS continues to
-- govern row access for authenticated. The whole file is idempotent (all
-- statements are REVOKEs or a single GRANT that already exists) and is safe
-- to re-apply.

-- 1. Undo the blanket grants from 20260518000000_platform_admin.sql.
revoke select, insert, update, delete on all tables in schema public from anon;
revoke usage, select on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

-- 2. Stop future tables/sequences/functions from auto-granting to anon.
alter default privileges in schema public revoke select, insert, update, delete on tables from anon;
alter default privileges in schema public revoke usage, select on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- 3. Belt-and-braces explicit revokes on the tables that had their own anon
--    grants in earlier migrations. These are already covered by the
--    schema-wide revoke above; included so this migration is self-contained
--    if someone re-grants in a later migration.
revoke all on public.merchant_features         from anon;
revoke all on public.announcements             from anon;
revoke all on public.admin_audit               from anon;
revoke all on public.merchant_payment_gateways from anon;  -- mirrors 20260606000000_payment_gateway_secrets.sql
revoke all on public.tax_rates                 from anon;

-- 4. Re-grant the one intentional anon-callable function.
--    public.is_platform_admin() returns false for anon (no auth.uid()) and
--    is referenced from RLS policies where Postgres needs anon to be able
--    to evaluate it. It never leaks privileges.
grant execute on function public.is_platform_admin() to anon;

-- Functions we deliberately do NOT re-grant to anon:
--   - public.resolve_tax_bps(text, text)         -- called post-auth only
--   - public.verify_device_passcode(uuid, text)  -- called post-auth only
--   - public.set_device_passcode(uuid, text)     -- never anon-callable
--   - public.void_order(uuid)                    -- authenticated/service_role only
--   - public.admin_*                             -- authenticated/service_role only
