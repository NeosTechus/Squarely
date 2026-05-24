-- Secure RPCs for the mobile super-admin Clients screen. They touch auth.users,
-- so they run SECURITY DEFINER and are guarded by is_platform_admin(). Passwords
-- are bcrypt-hashed with pgcrypto (the same scheme GoTrue verifies), so the
-- service-role key never ships in the mobile app.

-- Reset a merchant owner's password.
create or replace function public.admin_reset_owner_password(p_merchant_id uuid, p_password text)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  owner_id uuid;
begin
  if not public.is_platform_admin() then return 'Not authorized.'; end if;
  if length(coalesce(p_password, '')) < 8 then return 'Password must be at least 8 characters.'; end if;

  select user_id into owner_id
  from merchant_members
  where merchant_id = p_merchant_id and role = 'owner' and active = true
  limit 1;
  if owner_id is null then return 'Owner not found.'; end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = owner_id;

  begin
    insert into admin_audit (actor, action, merchant_id) values (auth.uid(), 'reset_password', p_merchant_id);
  exception when others then null; end;

  return 'ok';
end;
$$;

-- Onboard a brand-new client: owner auth user + merchant + membership + subscription.
create or replace function public.admin_onboard_merchant(
  p_business_name text,
  p_email text,
  p_password text,
  p_plan_tier text
)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  new_uid uuid;
  mid uuid;
  pid uuid;
  slug text;
  existing uuid;
  email_l text := lower(trim(p_email));
begin
  if not public.is_platform_admin() then return 'Not authorized.'; end if;
  if coalesce(trim(p_business_name), '') = '' or email_l = '' then return 'All fields are required.'; end if;
  if length(coalesce(p_password, '')) < 8 then return 'Password must be at least 8 characters.'; end if;

  select id into existing from auth.users where lower(email) = email_l limit 1;
  if existing is not null then return 'A user with that email already exists.'; end if;

  new_uid := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', new_uid, 'authenticated', 'authenticated',
    email_l, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), new_uid::text, new_uid,
    jsonb_build_object('sub', new_uid::text, 'email', email_l), 'email', now(), now(), now()
  );

  slug := coalesce(nullif(regexp_replace(lower(p_business_name), '[^a-z0-9]+', '-', 'g'), ''), 'store')
          || '-' || substr(new_uid::text, 1, 6);
  insert into merchants (name, slug, email) values (trim(p_business_name), slug, email_l) returning id into mid;
  insert into merchant_members (merchant_id, user_id, role, display_name, active)
  values (mid, new_uid, 'owner', 'Owner', true);

  select id into pid from plans where tier = p_plan_tier limit 1;
  if pid is not null then
    insert into subscriptions (merchant_id, plan_id, status, current_period_start, current_period_end)
    values (mid, pid, 'active', now(), now() + interval '30 days');
  end if;

  update auth.users
  set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('active_merchant_id', mid)
  where id = new_uid;

  begin
    insert into admin_audit (actor, action, merchant_id, detail) values (auth.uid(), 'onboard', mid, p_plan_tier);
  exception when others then null; end;

  return 'ok';
end;
$$;

grant execute on function public.admin_reset_owner_password(uuid, text) to authenticated;
grant execute on function public.admin_onboard_merchant(text, text, text, text) to authenticated;
