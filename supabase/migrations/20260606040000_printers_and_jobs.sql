-- Print receipts: extend `printers` with Devices-admin fields, and add a
-- `print_jobs` queue used by /api/printers/dispatch to enqueue a build of
-- ESC-POS XML for downstream dispatch.
--
-- Notes
-- - We do NOT rename existing columns (`label`, `active`) — the print-dispatch
--   edge function and the Devices admin page already depend on them.
-- - The existing `receipts` table is still used by the Epson SDP poll path
--   (supabase/functions/print-dispatch). `print_jobs` is a parallel, generic
--   queue keyed by status; a follow-up will reconcile the two.
-- - All DDL is idempotent so re-running this migration is safe.

-- ============ extend public.printers ============
alter table public.printers add column if not exists kind text not null default 'lan';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'printers_kind_chk'
  ) then
    alter table public.printers
      add constraint printers_kind_chk check (kind in ('lan','cloud'));
  end if;
end $$;

alter table public.printers add column if not exists port int not null default 9100;
alter table public.printers add column if not exists location_id uuid
  references public.locations(id) on delete set null;
alter table public.printers add column if not exists is_default boolean not null default false;
alter table public.printers add column if not exists created_at timestamptz not null default now();
alter table public.printers add column if not exists updated_at timestamptz not null default now();

create unique index if not exists printers_one_default_per_merchant
  on public.printers (merchant_id) where is_default;

drop trigger if exists printers_updated on public.printers;
create trigger printers_updated before update on public.printers
  for each row execute function public.tg_set_updated_at();

-- RLS for printers is already in place from the init migration (member read,
-- active-merchant write) and the platform_admin migration (pa_all). Nothing
-- to change here.

-- ============ public.print_jobs queue ============
create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  printer_id uuid references public.printers(id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued','dispatched','printed','failed','cancelled')),
  payload text not null,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  dispatched_at timestamptz,
  printed_at timestamptz
);

create index if not exists print_jobs_merchant_status_idx
  on public.print_jobs (merchant_id, status);
create index if not exists print_jobs_printer_status_idx
  on public.print_jobs (printer_id, status);
create index if not exists print_jobs_created_at_idx
  on public.print_jobs (created_at);

drop trigger if exists print_jobs_updated on public.print_jobs;
create trigger print_jobs_updated before update on public.print_jobs
  for each row execute function public.tg_set_updated_at();

-- RLS: members read; only owner/admin (active merchant) writes; platform admin
-- gets pa_all per house pattern.
alter table public.print_jobs enable row level security;

drop policy if exists print_jobs_select on public.print_jobs;
create policy print_jobs_select on public.print_jobs
  for select using (public.is_member_of(merchant_id));

drop policy if exists print_jobs_write on public.print_jobs;
create policy print_jobs_write on public.print_jobs
  for all using (
    merchant_id = public.active_merchant_id()
      and public.has_role(array['owner','admin']::merchant_role[])
  ) with check (
    merchant_id = public.active_merchant_id()
      and public.has_role(array['owner','admin']::merchant_role[])
  );

drop policy if exists pa_all on public.print_jobs;
create policy pa_all on public.print_jobs
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());
