
-- Role grants (RLS still governs row access). Persisted so a rebuild keeps them.
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- Platform admins can read merchants' subscriptions, locations, and members for the console.
drop policy if exists subs_admin_select on subscriptions;
create policy subs_admin_select on subscriptions for select using (public.is_platform_admin());
drop policy if exists locations_admin_select on locations;
create policy locations_admin_select on locations for select using (public.is_platform_admin());
drop policy if exists mm_admin_select on merchant_members;
create policy mm_admin_select on merchant_members for select using (public.is_platform_admin());

-- Platform admins get full read+write on merchant-scoped tables (for "view as client").
do $$
declare t text;
begin
  for t in select unnest(array[
    'locations','categories','modifier_groups','items','inventory_levels',
    'customers','loyalty_accounts','loyalty_transactions',
    'orders','order_items','order_item_modifiers','modifier_options',
    'terminals','printers','devices','payments','payment_events','receipts',
    'audit_events','subscriptions','merchant_payment_gateways','merchant_members'
  ]) loop
    execute format('drop policy if exists pa_all on %I;', t);
    execute format('create policy pa_all on %I for all using (public.is_platform_admin()) with check (public.is_platform_admin());', t);
  end loop;
end$$;
