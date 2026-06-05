-- Record the gateway-side transaction id on the order itself so refunds can
-- recover the original payment without depending on the `payments` table
-- (which is not populated by any current app code — verified 2026-06-05).
--
-- These two columns are written by /api/payments/status on a successful poll
-- and read by /api/refunds when the merchant issues a refund. Storing them
-- on `orders` keeps the read/write path single-row and avoids a join until
-- there is a real need for multi-row payment history.

alter table public.orders
  add column if not exists gateway_payment_id text,
  add column if not exists gateway_provider   text;

-- Sparse index: most rows are cash/UPI/manual and never get a value here.
create index if not exists orders_gateway_payment_id_idx
  on public.orders (gateway_payment_id)
  where gateway_payment_id is not null;
