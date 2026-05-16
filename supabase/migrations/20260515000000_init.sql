-- =========================================================================
-- Squarely — initial schema
-- Multi-tenant POS / Kiosk / KDS SaaS. Every business row carries merchant_id
-- and RLS enforces isolation via the active_merchant_id JWT claim.
-- =========================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ============== ENUMS ==============
create type merchant_role as enum (
  'owner', 'admin', 'manager', 'cashier', 'kitchen', 'viewer'
);
create type plan_tier as enum ('starter', 'growth', 'pro', 'enterprise');
create type subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'paused'
);
create type order_source as enum ('pos', 'kiosk', 'web', 'api');
create type order_type as enum ('pickup', 'delivery', 'dine_in', 'take_out');
create type order_status as enum (
  'pending', 'received', 'preparing', 'ready', 'completed', 'cancelled'
);
create type payment_method as enum ('card', 'cash', 'split', 'other');
create type payment_status as enum ('unpaid', 'paid', 'refunded', 'partial_refund', 'voided');
create type payment_provider_kind as enum (
  'valor', 'stripe_terminal', 'square_reader', 'cash', 'manual'
);
create type device_kind as enum (
  'ios_phone', 'ios_tablet', 'android_phone', 'android_tablet',
  'kds_display', 'kiosk_terminal'
);
create type boot_mode as enum ('pos', 'kiosk', 'kds', 'admin');

-- ============== HELPER FUNCTIONS ==============

-- Returns the merchant_id stored in the JWT claim `active_merchant_id`.
create or replace function public.active_merchant_id()
returns uuid language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'active_merchant_id',
      ''
    ),
    ''
  )::uuid
$$;

-- Returns true if the authed user is a member of the supplied merchant.
create or replace function public.is_member_of(p_merchant_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from merchant_members
    where merchant_id = p_merchant_id
      and user_id = auth.uid()
      and active = true
  );
$$;

-- Returns true if member has any of the supplied roles in their active merchant.
create or replace function public.has_role(p_roles merchant_role[])
returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from merchant_members
    where merchant_id = public.active_merchant_id()
      and user_id = auth.uid()
      and active = true
      and role = any(p_roles)
  );
$$;

-- RPC: switch the user's active merchant; the next sign-in cycle picks it up.
create or replace function public.set_active_merchant(p_merchant_id uuid)
returns void language plpgsql security definer as $$
begin
  if not public.is_member_of(p_merchant_id) then
    raise exception 'Not a member of merchant %', p_merchant_id;
  end if;
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('active_merchant_id', p_merchant_id::text)
  where id = auth.uid();
end;
$$;

-- ============== CORE TABLES ==============

create table merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  email text not null,
  phone text,
  address_line1 text, address_line2 text,
  city text, region text, postal_code text,
  country char(2) not null default 'US',
  currency char(3) not null default 'USD',
  timezone text not null default 'America/New_York',
  logo_url text,
  tax_rate_bps int not null default 0 check (tax_rate_bps between 0 and 10000),
  card_surcharge_bps int not null default 0 check (card_surcharge_bps between 0 and 10000),
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table merchant_members (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role merchant_role not null,
  display_name text,
  pin_hash text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (merchant_id, user_id)
);
create index on merchant_members (user_id) where active = true;
create index on merchant_members (merchant_id);

create table plans (
  id uuid primary key default gen_random_uuid(),
  tier plan_tier not null unique,
  display_name text not null,
  monthly_price_cents int not null,
  yearly_price_cents int not null,
  device_limit int,
  features jsonb not null default '[]'::jsonb,
  stripe_price_id_monthly text,
  stripe_price_id_yearly text
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  plan_id uuid not null references plans(id),
  status subscription_status not null,
  stripe_subscription_id text unique,
  revenuecat_entitlement text,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at timestamptz,
  trial_end timestamptz
);
create index on subscriptions (merchant_id);

create table locations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  name text not null,
  address_line1 text, city text, region text, postal_code text,
  timezone text not null default 'America/New_York',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on locations (merchant_id);

create table categories (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  name text not null,
  display_order int not null default 0,
  image_url text,
  active boolean not null default true
);
create index on categories (merchant_id);

create table modifier_groups (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  name text not null,
  required boolean not null default false,
  max_select int not null default 1,
  display_order int not null default 0
);
create index on modifier_groups (merchant_id);

create table modifier_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references modifier_groups(id) on delete cascade,
  name text not null,
  price_delta_cents int not null default 0,
  display_order int not null default 0,
  active boolean not null default true
);

create table items (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  description text,
  price_cents int not null check (price_cents >= 0),
  image_url text,
  sku text,
  barcode text,
  allergens text[] not null default '{}',
  pos_only boolean not null default false,
  kiosk_only boolean not null default false,
  active boolean not null default true,
  display_order int not null default 0,
  modifier_group_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index on items (merchant_id);
create index on items (merchant_id, category_id) where active = true;
create unique index items_merchant_barcode_uniq on items (merchant_id, barcode) where barcode is not null;

create table inventory_levels (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  quantity numeric not null default 0,
  reorder_threshold numeric,
  updated_at timestamptz not null default now(),
  unique (item_id, location_id)
);
create index on inventory_levels (merchant_id);

create table customers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  display_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);
create index on customers (merchant_id);
create index on customers (merchant_id, email) where email is not null;
create index on customers (merchant_id, phone) where phone is not null;

create table loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  points_balance int not null default 0,
  lifetime_points int not null default 0,
  tier text,
  unique (customer_id)
);

create table loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  account_id uuid not null references loyalty_accounts(id) on delete cascade,
  order_id uuid,
  delta int not null,
  reason text not null check (reason in ('earn','redeem','adjust','expire')),
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  number int not null,
  source order_source not null,
  order_type order_type not null,
  status order_status not null default 'pending',
  customer_id uuid references customers(id) on delete set null,
  customer_name text, customer_email text, customer_phone text,
  subtotal_cents int not null default 0,
  tax_cents int not null default 0,
  surcharge_cents int not null default 0,
  tip_cents int not null default 0,
  discount_cents int not null default 0,
  total_cents int not null default 0,
  payment_method payment_method,
  payment_status payment_status not null default 'unpaid',
  terminal_id uuid,
  receipt_printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on orders (merchant_id, created_at desc);
create index on orders (merchant_id, status) where status in ('pending','received','preparing','ready');
alter table orders enable row level security;

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  name_snapshot text not null,
  unit_price_cents int not null,
  quantity int not null check (quantity > 0),
  notes text
);
create index on order_items (order_id);

create table order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  modifier_group_id uuid not null,
  modifier_option_id uuid not null,
  name_snapshot text not null,
  price_delta_cents int not null default 0
);
create index on order_item_modifiers (order_item_id);

create table terminals (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  device_id uuid,
  provider payment_provider_kind not null,
  epi text,
  serial text,
  label text not null,
  active boolean not null default true,
  unique (merchant_id, epi)
);

create table printers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  label text not null,
  model text not null,
  ip_address text,
  serial text,
  cloud_device_id text,
  supports_cash_drawer boolean not null default true,
  active boolean not null default true
);

create table devices (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  name text not null,
  kind device_kind not null,
  boot_mode boot_mode not null,
  last_seen_at timestamptz,
  app_version text,
  os_version text,
  push_token text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  provider payment_provider_kind not null,
  provider_payment_id text,
  amount_cents int not null,
  tip_cents int not null default 0,
  currency char(3) not null default 'USD',
  status text not null check (status in ('pending','succeeded','failed','refunded','voided')),
  masked_pan text,
  card_brand text,
  auth_code text,
  rrn text,
  terminal_id uuid references terminals(id) on delete set null,
  receipt_url text,
  created_at timestamptz not null default now()
);
create index on payments (merchant_id);
create index on payments (order_id);

create table payment_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  payment_id uuid references payments(id) on delete cascade,
  kind text not null,
  provider payment_provider_kind not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  printer_id uuid references printers(id) on delete set null,
  epos_xml text not null,
  printed_at timestamptz,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);
create index on receipts (merchant_id, printed_at);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  actor_user_id uuid,
  kind text not null,
  target text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============== RLS POLICIES ==============
-- Pattern: every business table can be read by members of its merchant, mutated
-- by members of its active merchant. Service role bypasses RLS.

do $$
declare t text;
begin
  for t in select unnest(array[
    'merchants','merchant_members','subscriptions','locations',
    'categories','modifier_groups','modifier_options','items','inventory_levels',
    'customers','loyalty_accounts','loyalty_transactions',
    'orders','order_items','order_item_modifiers',
    'terminals','printers','devices','payments','payment_events','receipts','audit_events'
  ]) loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end$$;

-- Merchants: members read; only owner/admin updates.
create policy merchants_select on merchants for select using (public.is_member_of(id));
create policy merchants_update on merchants for update using (
  id = public.active_merchant_id() and public.has_role(array['owner','admin']::merchant_role[])
);

-- Merchant members: members of merchant can read; owner/admin can write.
create policy mm_select on merchant_members for select using (public.is_member_of(merchant_id));
create policy mm_write on merchant_members for all using (
  merchant_id = public.active_merchant_id() and public.has_role(array['owner','admin']::merchant_role[])
) with check (merchant_id = public.active_merchant_id());

-- Subscriptions: read by members; only service role writes.
create policy subs_select on subscriptions for select using (public.is_member_of(merchant_id));

-- Generic merchant-scoped policies for the rest of the tables.
do $$
declare t text;
begin
  for t in select unnest(array[
    'locations','categories','modifier_groups','modifier_options','items','inventory_levels',
    'customers','loyalty_accounts','loyalty_transactions',
    'orders','terminals','printers','devices','payments','payment_events','receipts','audit_events'
  ]) loop
    execute format($p$
      create policy %I_select on %I for select using (public.is_member_of(merchant_id));
      create policy %I_write on %I for all using (merchant_id = public.active_merchant_id())
        with check (merchant_id = public.active_merchant_id());
    $p$, t, t, t, t);
  end loop;
end$$;

-- order_items and order_item_modifiers join via their parent order's merchant.
create policy oi_select on order_items for select using (
  exists (select 1 from orders o where o.id = order_items.order_id and public.is_member_of(o.merchant_id))
);
create policy oi_write on order_items for all using (
  exists (select 1 from orders o where o.id = order_items.order_id and o.merchant_id = public.active_merchant_id())
) with check (
  exists (select 1 from orders o where o.id = order_items.order_id and o.merchant_id = public.active_merchant_id())
);

create policy oim_select on order_item_modifiers for select using (
  exists (
    select 1 from order_items oi
    join orders o on o.id = oi.order_id
    where oi.id = order_item_modifiers.order_item_id and public.is_member_of(o.merchant_id)
  )
);
create policy oim_write on order_item_modifiers for all using (
  exists (
    select 1 from order_items oi
    join orders o on o.id = oi.order_id
    where oi.id = order_item_modifiers.order_item_id and o.merchant_id = public.active_merchant_id()
  )
);

-- ============== ORDER NUMBER SEQUENCE PER MERCHANT ==============
create or replace function public.next_order_number(p_merchant_id uuid)
returns int language plpgsql as $$
declare n int;
begin
  select coalesce(max(number), 0) + 1 into n from orders where merchant_id = p_merchant_id;
  return n;
end;
$$;

-- ============== updated_at trigger ==============
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger merchants_updated before update on merchants
  for each row execute function public.tg_set_updated_at();
create trigger orders_updated before update on orders
  for each row execute function public.tg_set_updated_at();
