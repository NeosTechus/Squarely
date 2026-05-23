-- Suspend flag, announcements, and admin audit log for the platform console.
alter table merchants add column if not exists suspended boolean not null default false;

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table announcements enable row level security;
drop policy if exists ann_select on announcements;
create policy ann_select on announcements for select using (true);
drop policy if exists ann_admin_write on announcements;
create policy ann_admin_write on announcements for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create table if not exists admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor uuid,
  action text not null,
  merchant_id uuid,
  detail text,
  created_at timestamptz not null default now()
);
alter table admin_audit enable row level security;
drop policy if exists aa_admin_select on admin_audit;
create policy aa_admin_select on admin_audit for select using (public.is_platform_admin());
drop policy if exists aa_admin_write on admin_audit;
create policy aa_admin_write on admin_audit for all using (public.is_platform_admin()) with check (public.is_platform_admin());

grant select, insert, update, delete on announcements, admin_audit to anon, authenticated, service_role;

-- Kiosk landing customization (owner-editable via Settings).
alter table merchants add column if not exists kiosk_image_url text;
alter table merchants add column if not exists kiosk_headline text;
alter table merchants add column if not exists kiosk_subtext text;
