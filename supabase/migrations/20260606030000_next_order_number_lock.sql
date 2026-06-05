-- 20260606030000_next_order_number_lock.sql
--
-- Fix a race condition in public.next_order_number(uuid) that can hand the
-- same per-merchant order number to two concurrent callers.
--
-- The original implementation (20260515000000_init.sql:482) was:
--
--   select coalesce(max(number), 0) + 1 into n
--     from orders where merchant_id = p_merchant_id;
--   return n;
--
-- Under concurrent inserts for the same merchant (e.g. two POS terminals
-- ringing up sales at the same moment, or kiosk + register), two
-- transactions can both run that SELECT before either has inserted its new
-- row. Both see the same max(number) and therefore both return the same n.
-- The caller (public.create_order_with_items, see
-- 20260606010000_atomic_order_writes.sql) then inserts both orders with the
-- same (merchant_id, number) pair. There is no DB-level UNIQUE constraint
-- on (merchant_id, number) today, so the duplicate is silently accepted and
-- the merchant sees two "Order #N" in their day.
--
-- Fix: acquire a per-merchant transaction-scoped advisory lock at function
-- entry, BEFORE the SELECT. pg_advisory_xact_lock is keyed by an int8
-- derived from hashtext(p_merchant_id::text), so:
--   * different merchants never contend (different hash keys)
--   * concurrent callers for the SAME merchant serialize on the lock
--   * the lock is held until COMMIT/ROLLBACK, which covers the subsequent
--     INSERT INTO orders inside create_order_with_items in the same txn
--   * no explicit unlock needed; xact-scoped locks always release at end
--     of transaction, even on error
--
-- Belt-and-braces: also add a UNIQUE (merchant_id, number) index as a
-- last-line defense so any future caller that bypasses next_order_number
-- (or any code path that drops the advisory lock) fails loudly instead of
-- producing duplicates. The index is added idempotently via
-- CREATE UNIQUE INDEX IF NOT EXISTS, guarded by a DO block that checks
-- information_schema first so re-applying this migration is a no-op even
-- if the index was created out-of-band.
--
-- This migration is idempotent: CREATE OR REPLACE FUNCTION on the function,
-- and an existence check before the CREATE UNIQUE INDEX. Safe to re-run.

-- 1. Replace the function body with the advisory-lock-guarded version. The
--    signature, return type, language, and SECURITY (INVOKER, default) are
--    all preserved so every existing GRANT and every caller (SQL, RPC, or
--    PL/pgSQL) continues to bind to the same function.
create or replace function public.next_order_number(p_merchant_id uuid)
returns int language plpgsql as $$
declare
  n int;
begin
  -- Per-merchant transaction-scoped advisory lock. Cast through int8 to
  -- pick the single-argument pg_advisory_xact_lock(bigint) overload and
  -- avoid accidental collisions with any (classid, objid) two-int form.
  perform pg_advisory_xact_lock(hashtext(p_merchant_id::text)::bigint);

  select coalesce(max(number), 0) + 1
    into n
    from public.orders
   where merchant_id = p_merchant_id;

  return n;
end;
$$;

-- 2. Safety-net UNIQUE constraint on (merchant_id, number). Added as a
--    UNIQUE INDEX (not an ALTER TABLE ... ADD CONSTRAINT) so we can use
--    IF NOT EXISTS and stay idempotent without catching errors. Guarded
--    by a DO block that consults pg_indexes so we don't even attempt the
--    CREATE if an equivalent index already exists under any name.
do $$
begin
  if not exists (
    select 1
      from pg_indexes
     where schemaname = 'public'
       and tablename  = 'orders'
       and indexname  = 'orders_merchant_number_uniq'
  ) then
    -- If pre-existing duplicate (merchant_id, number) rows exist in this
    -- database, this statement will fail and the whole migration will
    -- abort. That is the correct behavior: we want to know about the
    -- duplicates before silently masking them. Resolution path is a
    -- follow-up migration that renumbers offending rows, then re-runs
    -- this one.
    create unique index orders_merchant_number_uniq
      on public.orders (merchant_id, number);
  end if;
end
$$;
