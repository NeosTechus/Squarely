-- Atomic order writes: insert orders + order_items + order_item_modifiers in a
-- single function body so any failure rolls the whole thing back. Replaces the
-- multi-statement client-side sequence used by POS/kiosk/register, which could
-- leave partial orders if any intermediate insert failed.
--
-- The trg_inventory_on_sale AFTER INSERT trigger on order_items continues to
-- work unchanged because orders is inserted before order_items, so the trigger
-- can resolve merchant_id/location_id from the same transaction.

create or replace function public.create_order_with_items(
  p_merchant_id uuid,
  p_order jsonb,
  p_items jsonb
) returns table (order_id uuid, order_number int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_number int;
  v_item jsonb;
  v_order_item_id uuid;
  v_mod jsonb;
begin
  -- Match the policy callers rely on today: any active member of the merchant
  -- can record a sale. RLS would catch it too, but we want a clean error here.
  if not public.is_member_of(p_merchant_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  v_number := public.next_order_number(p_merchant_id);

  insert into orders (
    merchant_id, number, source, order_type, status,
    subtotal_cents, tax_cents, surcharge_cents, tip_cents, discount_cents, total_cents,
    payment_method, payment_status, location_id,
    customer_id, customer_name, customer_email, customer_phone, terminal_id
  ) values (
    p_merchant_id,
    v_number,
    (p_order->>'source')::order_source,
    (p_order->>'order_type')::order_type,
    coalesce((p_order->>'status')::order_status, 'pending'),
    coalesce((p_order->>'subtotal_cents')::int, 0),
    coalesce((p_order->>'tax_cents')::int, 0),
    coalesce((p_order->>'surcharge_cents')::int, 0),
    coalesce((p_order->>'tip_cents')::int, 0),
    coalesce((p_order->>'discount_cents')::int, 0),
    coalesce((p_order->>'total_cents')::int, 0),
    nullif(p_order->>'payment_method', '')::payment_method,
    coalesce((p_order->>'payment_status')::payment_status, 'unpaid'),
    nullif(p_order->>'location_id', '')::uuid,
    nullif(p_order->>'customer_id', '')::uuid,
    p_order->>'customer_name',
    p_order->>'customer_email',
    p_order->>'customer_phone',
    nullif(p_order->>'terminal_id', '')::uuid
  ) returning id into v_order_id;

  -- Walk each item, insert it, then attach its modifiers (if any). The
  -- trg_inventory_on_sale AFTER INSERT trigger fires per row here and is safe
  -- because the parent orders row already exists in this transaction.
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into order_items (
      order_id, item_id, name_snapshot, unit_price_cents, quantity, notes
    ) values (
      v_order_id,
      nullif(v_item->>'item_id', '')::uuid,
      v_item->>'name_snapshot',
      (v_item->>'unit_price_cents')::int,
      (v_item->>'quantity')::int,
      v_item->>'notes'
    ) returning id into v_order_item_id;

    if (v_item ? 'modifiers') and jsonb_typeof(v_item->'modifiers') = 'array' then
      for v_mod in select * from jsonb_array_elements(v_item->'modifiers') loop
        insert into order_item_modifiers (
          order_item_id, modifier_group_id, modifier_option_id, name_snapshot, price_delta_cents
        ) values (
          v_order_item_id,
          (v_mod->>'modifier_group_id')::uuid,
          (v_mod->>'modifier_option_id')::uuid,
          v_mod->>'name_snapshot',
          coalesce((v_mod->>'price_delta_cents')::int, 0)
        );
      end loop;
    end if;
  end loop;

  order_id := v_order_id;
  order_number := v_number;
  return next;
end;
$$;

grant execute on function public.create_order_with_items(uuid, jsonb, jsonb)
  to authenticated, service_role;
