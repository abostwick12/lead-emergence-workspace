-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- PURPOSE: Record the privacy-safe first-value capture event exactly once.

create unique index if not exists product_events_first_capture_unique
  on workspace.product_events (workspace_id, event_name)
  where event_name = 'first_capture_created';

create or replace function workspace_private.record_first_capture_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into workspace.product_events (
    workspace_id,
    event_name,
    event_context,
    created_by,
    created_at
  ) values (
    new.workspace_id,
    'first_capture_created',
    '{"interface":"quick_capture"}'::jsonb,
    new.created_by,
    new.created_at
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function workspace_private.record_first_capture_created() from public, anon, authenticated;

drop trigger if exists capture_inbox_record_first_value on workspace.capture_inbox;
create trigger capture_inbox_record_first_value
after insert on workspace.capture_inbox
for each row execute function workspace_private.record_first_capture_created();

comment on function workspace_private.record_first_capture_created() is
  'Records only that a Workspace created its first capture; capture content is never copied into product analytics.';
