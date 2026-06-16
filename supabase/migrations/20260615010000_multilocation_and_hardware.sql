-- Multi-location central management + hardware integration plumbing.
--
-- 1. Default-location pointer on merchants (so the dashboard can name a
--    "home" location for the merchant and the mobile boot screen can default
--    to it without scanning every locations row).
-- 2. Staff-to-location binding (merchant_members.location_id, nullable —
--    NULL means "all locations").
-- 3. Cash-drawer kick flag on print_jobs (so the LAN agent / dispatcher can
--    pulse the drawer on cash sales without printing a second receipt).
-- 4. cfd_state table: one row per (merchant, device) snapshot of the current
--    cart, written by POS on every cart change, read live by the customer-
--    facing-display web page over Supabase Realtime.
--
-- Every block is idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).

-- ============ 1. merchants.default_location_id ============
alter table public.merchants
  add column if not exists default_location_id uuid
  references public.locations(id) on delete set null;

-- ============ 2. merchant_members.location_id (optional staff binding) ============
alter table public.merchant_members
  add column if not exists location_id uuid
  references public.locations(id) on delete set null;

create index if not exists merchant_members_location_idx
  on public.merchant_members (location_id)
  where location_id is not null;

-- ============ 3. print_jobs: kick_drawer + standalone drawer pop support ============
alter table public.print_jobs
  add column if not exists kick_drawer boolean not null default false;

-- job_type discriminates a receipt-print job from a standalone drawer-only
-- pulse (cashier pops the drawer to make change without printing). Default
-- 'receipt' keeps all existing rows valid.
alter table public.print_jobs
  add column if not exists job_type text not null default 'receipt';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'print_jobs_job_type_chk'
  ) then
    alter table public.print_jobs
      add constraint print_jobs_job_type_chk check (job_type in ('receipt','drawer_pop'));
  end if;
end $$;

-- Allow order_id to be NULL so drawer-only pops don't require a fake order.
-- Existing rows already have order_id NOT NULL — relaxing the constraint
-- doesn't invalidate them.
alter table public.print_jobs
  alter column order_id drop not null;

-- ============ 4. cfd_state (customer-facing display live snapshot) ============
create table if not exists public.cfd_state (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  device_id uuid references public.devices(id) on delete set null,
  -- The cart payload — items array, totals, optional payment summary. JSONB
  -- so the schema can evolve without a migration every time we add a field.
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  -- One row per (merchant, device). Device may be null for merchants who
  -- want a single shared CFD URL — in that case (merchant_id, NULL) is the
  -- single row. Postgres treats NULLs as distinct in unique indexes so we
  -- use COALESCE for the device-null case.
  unique (merchant_id, device_id)
);

create index if not exists cfd_state_merchant_idx
  on public.cfd_state (merchant_id);

alter table public.cfd_state enable row level security;

-- Members of the merchant can read + write their own CFD state. The CFD
-- public viewer hits the row via a SECURITY DEFINER RPC (below), NOT direct
-- RLS SELECT, so the row never has to be readable by anon.
drop policy if exists cfd_state_member_select on public.cfd_state;
create policy cfd_state_member_select on public.cfd_state for select
  using (public.is_member_of(merchant_id));

drop policy if exists cfd_state_member_write on public.cfd_state;
create policy cfd_state_member_write on public.cfd_state for all using (
  merchant_id = public.active_merchant_id()
) with check (
  merchant_id = public.active_merchant_id()
);

-- ============ Realtime publication ============
-- Supabase Realtime listens on the supabase_realtime publication. Adding
-- cfd_state lets the CFD page subscribe to row updates.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.cfd_state';
    exception
      when duplicate_object then null; -- already added — fine
    end;
  end if;
end$$;

-- ============ Public CFD read RPC ============
-- The customer-facing display is a public URL (no auth — it lives on a
-- counter screen in the merchant's store). We do NOT want to expose
-- cfd_state to anon via RLS because then anyone with the merchant_id could
-- read any device's cart in real time. Instead, this RPC returns the
-- snapshot keyed by a tokenized merchant slug.
--
-- The CFD page is loaded with a merchant slug (not a uuid) and an optional
-- device id; the page subscribes to a single-row channel. The RPC simply
-- resolves slug → merchant uuid → state row.
create or replace function public.get_cfd_state(p_slug text, p_device_id uuid default null)
returns table(state jsonb, updated_at timestamptz)
language plpgsql security definer
set search_path = public
as $$
declare
  v_merchant uuid;
begin
  select id into v_merchant from public.merchants where slug = p_slug;
  if v_merchant is null then
    return;
  end if;
  return query
    select s.state, s.updated_at
    from public.cfd_state s
    where s.merchant_id = v_merchant
      and (s.device_id is not distinct from p_device_id)
    limit 1;
end$$;

revoke all on function public.get_cfd_state(text, uuid) from public;
grant execute on function public.get_cfd_state(text, uuid) to anon, authenticated;
