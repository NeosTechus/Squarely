-- Captures schema items that existed on the original live DB but were never
-- written into a migration file. Applied to the new project on 2026-06-01.
-- Safe to apply to any environment (all guards use IF NOT EXISTS / OR REPLACE).

-- 1. Platform admins table + helper function.
-- Referenced by policies in 20260518000000_platform_admin.sql but never defined
-- there; previously created out-of-band on the old project.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
drop policy if exists pa_self_read on public.platform_admins;
create policy pa_self_read on public.platform_admins for select using (user_id = auth.uid());

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
grant execute on function public.is_platform_admin() to anon, authenticated, service_role;

-- 2. Merchant brand color (owner customization, used by /dashboard/settings).
alter table public.merchants add column if not exists brand_color text;
update public.merchants set brand_color = '#4f46e5' where brand_color is null;
alter table public.merchants alter column brand_color set default '#4f46e5';
alter table public.merchants alter column brand_color set not null;

-- 3. Per-merchant feature toggles (POS / Kiosk / KDS / Admin) used by:
--    - Super-admin /admin/clients (enable/disable mobile modes per client)
--    - Mobile boot picker (filters mode tiles by these flags)
create table if not exists public.merchant_features (
  merchant_id uuid primary key references public.merchants(id) on delete cascade,
  pos boolean not null default true,
  kiosk boolean not null default true,
  kds boolean not null default true,
  admin boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.merchant_features enable row level security;
drop policy if exists pa_all on public.merchant_features;
create policy pa_all on public.merchant_features for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists mf_member_select on public.merchant_features;
create policy mf_member_select on public.merchant_features for select
  using (public.is_member_of(merchant_id));
grant select, insert, update, delete on public.merchant_features to anon, authenticated, service_role;
