-- SECURITY DEFINER RPCs so the mobile app (anon key + admin JWT) can manage
-- platform admins without ever shipping the service-role key. Every function
-- is guarded by public.is_platform_admin() so only platform admins can call it.

-- List all platform admins with their auth email.
create or replace function public.admin_list_platform_admins()
returns table (user_id uuid, email text, created_at timestamptz)
language sql
security definer
set search_path = public, auth
as $$
  select pa.user_id, u.email::text, pa.created_at
  from platform_admins pa
  join auth.users u on u.id = pa.user_id
  where public.is_platform_admin()
  order by u.email;
$$;

-- Promote an existing user (by email) to platform admin.
-- Returns 'ok', or an error string the client can surface.
create or replace function public.admin_add_platform_admin(p_email text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target uuid;
begin
  if not public.is_platform_admin() then
    return 'Not authorized.';
  end if;

  select id into target from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if target is null then
    return 'No user with that email — they must sign up first.';
  end if;

  insert into platform_admins (user_id)
  values (target)
  on conflict (user_id) do nothing;

  return 'ok';
end;
$$;

-- Remove a platform admin. Callers cannot remove themselves.
create or replace function public.admin_remove_platform_admin(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_platform_admin() then
    return 'Not authorized.';
  end if;
  if p_user_id = auth.uid() then
    return 'You cannot remove yourself.';
  end if;

  delete from platform_admins where user_id = p_user_id;
  return 'ok';
end;
$$;

grant execute on function public.admin_list_platform_admins() to authenticated;
grant execute on function public.admin_add_platform_admin(text) to authenticated;
grant execute on function public.admin_remove_platform_admin(uuid) to authenticated;
