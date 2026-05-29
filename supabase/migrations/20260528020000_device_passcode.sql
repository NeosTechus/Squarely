-- Device passcode (PIN) to gate entering POS/Kiosk on a logged-in device.
-- Stored as a bcrypt hash; set/verified via SECURITY DEFINER RPCs so staff
-- can't read the code and the owner manages it from the web dashboard.
alter table merchants add column if not exists device_passcode text;

create or replace function public.set_device_passcode(p_merchant_id uuid, p_code text)
returns text language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (public.is_platform_admin()
          or (p_merchant_id = public.active_merchant_id()
              and public.has_role(array['owner','admin']::merchant_role[]))) then
    return 'Not authorized.';
  end if;
  if coalesce(trim(p_code), '') = '' then
    update merchants set device_passcode = null where id = p_merchant_id;
    return 'ok';
  end if;
  if length(trim(p_code)) < 4 then return 'Passcode must be at least 4 digits.'; end if;
  update merchants set device_passcode = extensions.crypt(trim(p_code), extensions.gen_salt('bf'))
    where id = p_merchant_id;
  return 'ok';
end; $$;

create or replace function public.verify_device_passcode(p_merchant_id uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select device_passcode into h from merchants where id = p_merchant_id;
  if h is null then return true; end if; -- no passcode set = open
  return h = extensions.crypt(coalesce(p_code,''), h);
end; $$;

grant execute on function public.set_device_passcode(uuid, text) to authenticated, service_role;
grant execute on function public.verify_device_passcode(uuid, text) to anon, authenticated, service_role;
