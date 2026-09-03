-- READ-ONLY P2 release preflight. Run against the intended target only after
-- the B2.1 migration is present. This does not install or configure pg_cron.
-- It fails closed unless the exact active 15-minute cleanup job is present.

do $$
declare
  readiness jsonb;
begin
  readiness := workspace_private.professional_context_cleanup_schedule_status();
  if not coalesce((readiness ->> 'ready')::boolean, false) then
    raise exception 'Professional Context cleanup scheduler is NOT READY: %', readiness::text
      using errcode = '55000';
  end if;
end;
$$;

select workspace_private.professional_context_cleanup_schedule_status()
  as professional_context_cleanup_scheduler_readiness;
