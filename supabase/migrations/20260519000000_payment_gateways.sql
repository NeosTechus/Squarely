-- Per-merchant pluggable payment gateways.
create table if not exists merchant_payment_gateways (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  provider text not null,
  enabled boolean not null default true,
  is_default boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, provider)
);
create index if not exists mpg_merchant on merchant_payment_gateways (merchant_id);
alter table merchant_payment_gateways enable row level security;

drop policy if exists mpg_select on merchant_payment_gateways;
create policy mpg_select on merchant_payment_gateways for select using (public.is_member_of(merchant_id));

drop policy if exists mpg_write on merchant_payment_gateways;
create policy mpg_write on merchant_payment_gateways for all
  using (merchant_id = public.active_merchant_id() and public.has_role(array['owner','admin']::merchant_role[]))
  with check (merchant_id = public.active_merchant_id() and public.has_role(array['owner','admin']::merchant_role[]));

grant select, insert, update, delete on merchant_payment_gateways to anon, authenticated, service_role;
