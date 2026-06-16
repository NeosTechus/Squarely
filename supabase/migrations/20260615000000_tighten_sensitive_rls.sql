-- Tighten RLS on five tables that the generic init.sql do-block had granted
-- FOR ALL (any active member can insert/update/delete) by default. These are
-- tables the app treats as either service-role-only or as append-only audit
-- surfaces; the original generic policy contradicts that contract.
--
-- The init.sql policies were created with names like '<table>_write'. We drop
-- those and replace them per-table with the correct gates.

-- ============== payments ==============
-- No app code writes to public.payments — the actual payment trail lives on
-- orders.gateway_payment_id + admin_audit. Restrict to service-role writes.
drop policy if exists payments_write on payments;
-- (no replacement write policy → only service_role can write, which always
-- bypasses RLS. SELECT remains: merchant members can read.)

-- ============== payment_events ==============
-- Same as payments: service-role-only writes. Reads stay open to members.
drop policy if exists payment_events_write on payment_events;

-- ============== audit_events ==============
-- Append-only: members may INSERT (the orderbook-side audit events the app
-- emits client-side), but NEVER update or delete. Service-role retains full
-- access for retention sweeps.
drop policy if exists audit_events_write on audit_events;
create policy audit_events_insert on audit_events for insert
  with check (merchant_id = public.active_merchant_id());
-- (no update/delete policy → only service_role can mutate or purge.)

-- ============== receipts ==============
-- Owner/admin write; all members can read (already covered by receipts_select).
-- This prevents a cashier from rewriting a receipt row that the merchant
-- believes is part of the immutable transaction record.
drop policy if exists receipts_write on receipts;
create policy receipts_write on receipts for all using (
  merchant_id = public.active_merchant_id()
  and public.has_role(array['owner','admin']::merchant_role[])
) with check (
  merchant_id = public.active_merchant_id()
  and public.has_role(array['owner','admin']::merchant_role[])
);

-- ============== inventory_levels ==============
-- Owner/admin/manager write. Cashiers and viewers must NOT be able to edit
-- stock counts. The apply_inventory_on_sale trigger runs SECURITY DEFINER
-- so the order checkout path keeps working without owner privilege.
drop policy if exists inventory_levels_write on inventory_levels;
create policy inventory_levels_write on inventory_levels for all using (
  merchant_id = public.active_merchant_id()
  and public.has_role(array['owner','admin','manager']::merchant_role[])
) with check (
  merchant_id = public.active_merchant_id()
  and public.has_role(array['owner','admin','manager']::merchant_role[])
);
