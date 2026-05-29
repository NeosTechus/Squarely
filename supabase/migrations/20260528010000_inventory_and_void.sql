-- P1 #3 inventory-on-sale + #4 refund/void.

-- Decrement inventory when an order line is created. Only touches existing
-- inventory rows, so items without inventory tracking are unaffected.
create or replace function public.apply_inventory_on_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mid uuid;
  loc uuid;
begin
  if NEW.item_id is null then return NEW; end if;
  select merchant_id, location_id into mid, loc from orders where id = NEW.order_id;
  if mid is null then return NEW; end if;

  if loc is not null then
    update inventory_levels
      set quantity = quantity - NEW.quantity, updated_at = now()
      where item_id = NEW.item_id and location_id = loc;
  else
    update inventory_levels
      set quantity = quantity - NEW.quantity, updated_at = now()
      where item_id = NEW.item_id and merchant_id = mid;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_inventory_on_sale on order_items;
create trigger trg_inventory_on_sale
  after insert on order_items
  for each row execute function public.apply_inventory_on_sale();

-- Void/refund an order: restore inventory, mark cancelled + voided.
-- Guarded: caller must be a platform admin or an active member of the merchant.
create or replace function public.void_order(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  mid uuid;
  loc uuid;
  cur_status text;
begin
  select merchant_id, location_id, status::text into mid, loc, cur_status
    from orders where id = p_order_id;
  if mid is null then return 'Order not found.'; end if;
  if not (public.is_platform_admin()
          or exists (select 1 from merchant_members
                     where user_id = auth.uid() and merchant_id = mid and active)) then
    return 'Not authorized.';
  end if;
  if cur_status = 'cancelled' then return 'Already voided.'; end if;

  -- Restore inventory for each line (reverse the sale).
  update inventory_levels il
    set quantity = il.quantity + oi.quantity, updated_at = now()
    from order_items oi
    where oi.order_id = p_order_id and oi.item_id = il.item_id
      and ((loc is not null and il.location_id = loc) or (loc is null and il.merchant_id = mid));

  update orders
    set status = 'cancelled', payment_status = 'voided', updated_at = now()
    where id = p_order_id;
  return 'ok';
end;
$$;

grant execute on function public.void_order(uuid) to authenticated, service_role;
