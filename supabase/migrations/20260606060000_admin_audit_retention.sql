-- Retention + viewer support for public.admin_audit.
-- Adds:
--   1. An index on created_at desc so the /admin/audit viewer ("order by
--      created_at desc limit N") and the purge predicate
--      ("delete where created_at < ...") don't seq-scan as rows accumulate.
--   2. A SECURITY DEFINER RPC public.purge_admin_audit(p_keep_days int) that
--      deletes admin_audit rows older than p_keep_days. Guarded by
--      public.is_platform_admin() and self-audits the purge so the deletion
--      itself is visible in the log afterwards.
--
-- Idempotent: index uses IF NOT EXISTS, function uses CREATE OR REPLACE,
-- grants are idempotent. Safe to re-run.

create index if not exists admin_audit_created_at_idx
  on public.admin_audit (created_at desc);

create or replace function public.purge_admin_audit(p_keep_days int default 365)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  if p_keep_days is null or p_keep_days < 1 then
    raise exception 'p_keep_days must be >= 1' using errcode = '22023';
  end if;

  with d as (
    delete from public.admin_audit
    where created_at < now() - make_interval(days => p_keep_days)
    returning 1
  )
  select count(*) into deleted from d;

  -- Self-audit the purge so admins can see who cleared the log and how much.
  -- Best-effort: never let an audit insert error mask the purge result.
  begin
    insert into public.admin_audit(actor, action, detail)
    values (
      auth.uid(),
      'purge_audit',
      format('kept_days=%s deleted=%s', p_keep_days, deleted)
    );
  exception when others then
    null;
  end;

  return deleted;
end;
$$;

revoke all on function public.purge_admin_audit(int) from public;
grant execute on function public.purge_admin_audit(int) to authenticated;
