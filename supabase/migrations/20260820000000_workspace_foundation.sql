-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- PURPOSE: Standalone Workspace schema, tenant security, and private storage boundary.
--
-- Canonical source for deterministic shared-project packaging. The packaging
-- script reads this committed file and injects the source repository, commit,
-- and checksum into the generated package; no provisional provenance belongs
-- in this authoritative SQL.

create extension if not exists pgcrypto;

create schema if not exists workspace;
create schema if not exists workspace_private;

revoke all on schema workspace from public, anon;
grant usage on schema workspace to authenticated;

revoke all on schema workspace_private from public, anon, authenticated;

alter default privileges in schema workspace revoke all on tables from public, anon;
alter default privileges in schema workspace revoke all on sequences from public, anon;
alter default privileges in schema workspace_private revoke execute on functions from public, anon, authenticated;

-- Private authorization helpers. They derive the principal only from auth.uid()
-- and are intentionally not in the exposed `workspace` schema.
-- Their referenced tables are declared below, so defer function-body validation
-- until the full schema exists in this transaction.
set check_function_bodies = off;
create or replace function workspace_private.is_active_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from workspace.workspace_memberships as membership
    where membership.workspace_id = target_workspace_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;

create or replace function workspace_private.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from workspace.workspaces as workspace_record
    join workspace.workspace_memberships as membership
      on membership.workspace_id = workspace_record.id
    where workspace_record.id = target_workspace_id
      and workspace_record.owner_user_id = auth.uid()
      and membership.user_id = auth.uid()
      and membership.role = 'owner'
      and membership.status = 'active'
  );
$$;

revoke all on function workspace_private.is_active_member(uuid) from public;
revoke all on function workspace_private.is_workspace_owner(uuid) from public;
grant execute on function workspace_private.is_active_member(uuid) to authenticated;
grant execute on function workspace_private.is_workspace_owner(uuid) to authenticated;
set check_function_bodies = on;

create table if not exists workspace.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'America/Chicago',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace.workspaces (
  id uuid primary key default gen_random_uuid(),
  workspace_type text not null default 'personal' check (workspace_type in ('personal', 'organization')),
  name text not null check (char_length(name) between 1 and 160),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_user_id)
);

create unique index if not exists workspace_one_personal_workspace_per_owner
  on workspace.workspaces (owner_user_id)
  where workspace_type = 'personal';

create table if not exists workspace.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (workspace_id, user_id)
);

create index if not exists workspace_memberships_user_workspace_idx
  on workspace.workspace_memberships (user_id, workspace_id)
  where status = 'active';

create table if not exists workspace.workspace_entitlements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  feature_key text not null check (feature_key in ('leader_mode')),
  enabled boolean not null default false,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  granted_by uuid references auth.users(id) on delete set null,
  unique (workspace_id, feature_key)
);

create table if not exists workspace.integration_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  provider text not null check (provider in ('google_calendar', 'gmail', 'google_drive', 'slack', 'firecrawl', 'monday', 'linkedin')),
  status text not null default 'reconnect_required' check (status in ('reconnect_required', 'connected', 'disconnected', 'error')),
  connected_account_label text,
  scopes text[] not null default '{}',
  secret_reference text,
  connected_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

-- No integration secret or raw OAuth response belongs in this exposed schema.
create table if not exists workspace.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  description text,
  status text not null default 'active' check (status in ('active', 'on_hold', 'completed', 'archived')),
  target_date date,
  tags text[] not null default '{}',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table if not exists workspace.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  project_id uuid,
  domain text not null default 'general' check (domain in ('general', 'military_transition', 'sotf_fellowship', 'job_search', 'life', 'leadership')),
  title text not null check (char_length(title) between 1 and 240),
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done')),
  priority text not null default 'medium' check (priority in ('critical', 'high', 'medium', 'low')),
  due_date date,
  tags text[] not null default '{}',
  external_source text,
  external_id text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, workspace_id) references workspace.projects(id, workspace_id) on delete set null (project_id),
  unique (id, workspace_id),
  unique (workspace_id, external_source, external_id)
);

create table if not exists workspace.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  project_id uuid,
  title text,
  body text not null default '',
  tags text[] not null default '{}',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, workspace_id) references workspace.projects(id, workspace_id) on delete set null (project_id)
);

create table if not exists workspace.meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  notes text,
  status text not null default 'planned' check (status in ('planned', 'completed', 'cancelled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table if not exists workspace.decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  project_id uuid,
  meeting_id uuid,
  title text not null check (char_length(title) between 1 and 240),
  rationale text,
  decided_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'superseded', 'reversed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, workspace_id) references workspace.projects(id, workspace_id) on delete set null (project_id),
  foreign key (meeting_id, workspace_id) references workspace.meetings(id, workspace_id) on delete set null (meeting_id)
);

create table if not exists workspace.commitments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  details text,
  due_date date,
  status text not null default 'open' check (status in ('open', 'fulfilled', 'cancelled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace.files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  entity_type text not null check (entity_type in ('project', 'task', 'note', 'meeting', 'decision', 'commitment', 'general')),
  entity_id uuid,
  object_path text not null unique check (object_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'),
  original_name text not null check (char_length(original_name) between 1 and 255),
  content_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  checksum_sha256 text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace.capture_inbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  raw_text text not null check (char_length(raw_text) between 1 and 10000),
  status text not null default 'unprocessed' check (status in ('unprocessed', 'processed', 'discarded')),
  routed_task_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (routed_task_id, workspace_id) references workspace.tasks(id, workspace_id) on delete set null (routed_task_id)
);

create table if not exists workspace.job_applications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  company text not null check (char_length(company) between 1 and 240),
  role text not null check (char_length(role) between 1 and 240),
  status text not null default 'researching' check (status in ('researching', 'applied', 'phone_screen', 'interview', 'offer', 'rejected', 'withdrawn')),
  applied_date date,
  contact_name text,
  contact_notes text,
  next_follow_up_date date,
  compensation_notes text,
  job_url text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace.memory_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  memory_type text not null check (memory_type in ('fact', 'preference', 'context', 'relationship')),
  content text not null check (char_length(content) between 1 and 10000),
  domain text check (domain is null or domain in ('general', 'military_transition', 'sotf_fellowship', 'job_search', 'life', 'leadership')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  session_id text not null check (char_length(session_id) between 1 and 200),
  role text not null check (role in ('system', 'user', 'assistant', 'tool')),
  content text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists workspace.daily_briefings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  briefing_date date not null,
  items jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, briefing_date)
);

create table if not exists workspace.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  external_file_id text,
  file_name text not null,
  file_path text,
  source_type text not null check (source_type in ('article', 'podcast', 'video', 'linkedin', 'report')),
  title text not null,
  source_name text,
  source_url text,
  content_hash text,
  status text not null default 'new' check (status in ('new', 'included', 'skipped', 'archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, external_file_id)
);

create table if not exists workspace.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  source_id uuid not null,
  summary text not null,
  key_takeaways text,
  topic_tags text[] not null default '{}',
  relevance_score numeric,
  workspace_application text,
  caveats text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (source_id, workspace_id) references workspace.knowledge_sources(id, workspace_id) on delete cascade
);

create table if not exists workspace.weekly_feeds (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  title text not null,
  executive_summary text not null,
  top_topics text[] not null default '{}',
  suggested_action_items text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, week_start)
);

create table if not exists workspace.weekly_feed_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  weekly_feed_id uuid not null,
  knowledge_item_id uuid not null,
  rank integer not null check (rank > 0),
  section text not null,
  reason_included text,
  recommended_action text,
  confidence_note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (weekly_feed_id, workspace_id) references workspace.weekly_feeds(id, workspace_id) on delete cascade,
  foreign key (knowledge_item_id, workspace_id) references workspace.knowledge_items(id, workspace_id) on delete cascade,
  unique (weekly_feed_id, knowledge_item_id)
);

create table if not exists workspace.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workspace_projects_workspace_status_idx on workspace.projects (workspace_id, status);
create index if not exists workspace_tasks_workspace_status_due_idx on workspace.tasks (workspace_id, status, due_date);
create index if not exists workspace_tasks_workspace_project_idx on workspace.tasks (workspace_id, project_id);
create index if not exists workspace_notes_workspace_created_idx on workspace.notes (workspace_id, created_at desc);
create index if not exists workspace_meetings_workspace_starts_idx on workspace.meetings (workspace_id, starts_at);
create index if not exists workspace_decisions_workspace_decided_idx on workspace.decisions (workspace_id, decided_at desc);
create index if not exists workspace_commitments_workspace_status_due_idx on workspace.commitments (workspace_id, status, due_date);
create index if not exists workspace_files_workspace_entity_idx on workspace.files (workspace_id, entity_type, entity_id);
create index if not exists workspace_capture_inbox_workspace_status_idx on workspace.capture_inbox (workspace_id, status, created_at desc);
create index if not exists workspace_job_applications_workspace_status_idx on workspace.job_applications (workspace_id, status, next_follow_up_date);
create index if not exists workspace_memory_entries_workspace_domain_idx on workspace.memory_entries (workspace_id, domain);
create index if not exists workspace_ai_conversations_workspace_session_idx on workspace.ai_conversations (workspace_id, session_id, created_at);
create index if not exists workspace_audit_events_workspace_created_idx on workspace.audit_events (workspace_id, created_at desc);

create or replace function workspace_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create or replace function workspace_private.enforce_immutable_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'workspaces' then
    if new.workspace_type is distinct from old.workspace_type
      or new.owner_user_id is distinct from old.owner_user_id then
      raise exception 'Workspace type and owner are immutable.';
    end if;
  elsif tg_table_name = 'workspace_memberships' then
    if new.workspace_id is distinct from old.workspace_id
      or new.user_id is distinct from old.user_id
      or new.role is distinct from old.role then
      raise exception 'Membership tenant, user, and role are immutable.';
    end if;
  elsif tg_table_name = 'user_profiles' then
    if new.user_id is distinct from old.user_id then
      raise exception 'Profile user is immutable.';
    end if;
  else
    if new.workspace_id is distinct from old.workspace_id
      or new.created_by is distinct from old.created_by then
      raise exception 'Workspace tenant and creator are immutable.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function workspace_private.audit_workspace_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_document jsonb;
  event_workspace_id uuid;
  event_entity_id uuid;
begin
  row_document := case when tg_op = 'DELETE' then pg_catalog.to_jsonb(old) else pg_catalog.to_jsonb(new) end;
  event_workspace_id := (row_document ->> 'workspace_id')::uuid;
  event_entity_id := (row_document ->> 'id')::uuid;

  insert into workspace.audit_events (workspace_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    event_workspace_id,
    auth.uid(),
    pg_catalog.lower(tg_op),
    tg_table_name,
    event_entity_id,
    pg_catalog.jsonb_build_object('source', 'database_trigger')
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function workspace_private.set_updated_at() from public;
revoke all on function workspace_private.enforce_immutable_tenancy() from public;
revoke all on function workspace_private.audit_workspace_mutation() from public;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_profiles', 'workspaces', 'workspace_memberships', 'integration_connections',
    'projects', 'tasks', 'notes', 'meetings', 'decisions', 'commitments', 'files',
    'capture_inbox', 'job_applications', 'memory_entries', 'daily_briefings',
    'knowledge_sources', 'knowledge_items', 'weekly_feeds'
  ]
  loop
    execute format('drop trigger if exists %I on workspace.%I', table_name || '_set_updated_at', table_name);
    execute format(
      'create trigger %I before update on workspace.%I for each row execute function workspace_private.set_updated_at()',
      table_name || '_set_updated_at', table_name
    );
  end loop;

  foreach table_name in array array[
    'user_profiles', 'workspaces', 'workspace_memberships', 'integration_connections',
    'projects', 'tasks', 'notes', 'meetings', 'decisions', 'commitments', 'files',
    'capture_inbox', 'job_applications', 'memory_entries', 'daily_briefings',
    'knowledge_sources', 'knowledge_items', 'weekly_feeds', 'weekly_feed_items', 'ai_conversations'
  ]
  loop
    execute format('drop trigger if exists %I on workspace.%I', table_name || '_enforce_immutable_tenancy', table_name);
    execute format(
      'create trigger %I before update on workspace.%I for each row execute function workspace_private.enforce_immutable_tenancy()',
      table_name || '_enforce_immutable_tenancy', table_name
    );
  end loop;

  foreach table_name in array array[
    'integration_connections', 'projects', 'tasks', 'notes', 'meetings', 'decisions',
    'commitments', 'files', 'capture_inbox', 'job_applications', 'memory_entries',
    'daily_briefings', 'knowledge_sources', 'knowledge_items', 'weekly_feeds',
    'weekly_feed_items', 'ai_conversations'
  ]
  loop
    execute format('drop trigger if exists %I on workspace.%I', table_name || '_audit_mutation', table_name);
    execute format(
      'create trigger %I after insert or update or delete on workspace.%I for each row execute function workspace_private.audit_workspace_mutation()',
      table_name || '_audit_mutation', table_name
    );
  end loop;
end;
$$;

alter table workspace.user_profiles enable row level security;
alter table workspace.workspaces enable row level security;
alter table workspace.workspace_memberships enable row level security;
alter table workspace.workspace_entitlements enable row level security;
alter table workspace.integration_connections enable row level security;
alter table workspace.projects enable row level security;
alter table workspace.tasks enable row level security;
alter table workspace.notes enable row level security;
alter table workspace.meetings enable row level security;
alter table workspace.decisions enable row level security;
alter table workspace.commitments enable row level security;
alter table workspace.files enable row level security;
alter table workspace.capture_inbox enable row level security;
alter table workspace.job_applications enable row level security;
alter table workspace.memory_entries enable row level security;
alter table workspace.ai_conversations enable row level security;
alter table workspace.daily_briefings enable row level security;
alter table workspace.knowledge_sources enable row level security;
alter table workspace.knowledge_items enable row level security;
alter table workspace.weekly_feeds enable row level security;
alter table workspace.weekly_feed_items enable row level security;
alter table workspace.audit_events enable row level security;

revoke all on all tables in schema workspace from public, anon;
grant select, insert, update on workspace.user_profiles to authenticated;
grant select, insert, update on workspace.workspaces to authenticated;
grant select, insert on workspace.workspace_memberships to authenticated;
grant select on workspace.workspace_entitlements to authenticated;
grant select, insert, update, delete on workspace.integration_connections to authenticated;
grant select, insert, update, delete on workspace.projects to authenticated;
grant select, insert, update, delete on workspace.tasks to authenticated;
grant select, insert, update, delete on workspace.notes to authenticated;
grant select, insert, update, delete on workspace.meetings to authenticated;
grant select, insert, update, delete on workspace.decisions to authenticated;
grant select, insert, update, delete on workspace.commitments to authenticated;
grant select, insert, update, delete on workspace.files to authenticated;
grant select, insert, update, delete on workspace.capture_inbox to authenticated;
grant select, insert, update, delete on workspace.job_applications to authenticated;
grant select, insert, update, delete on workspace.memory_entries to authenticated;
grant select, insert, update, delete on workspace.ai_conversations to authenticated;
grant select, insert, update, delete on workspace.daily_briefings to authenticated;
grant select, insert, update, delete on workspace.knowledge_sources to authenticated;
grant select, insert, update, delete on workspace.knowledge_items to authenticated;
grant select, insert, update, delete on workspace.weekly_feeds to authenticated;
grant select, insert, update, delete on workspace.weekly_feed_items to authenticated;
grant select on workspace.audit_events to authenticated;

drop policy if exists user_profiles_select_self on workspace.user_profiles;
drop policy if exists user_profiles_insert_self on workspace.user_profiles;
drop policy if exists user_profiles_update_self on workspace.user_profiles;
drop policy if exists workspaces_select_member on workspace.workspaces;
drop policy if exists workspaces_insert_personal_owner on workspace.workspaces;
drop policy if exists workspaces_update_personal_owner on workspace.workspaces;
drop policy if exists workspace_memberships_select_self on workspace.workspace_memberships;
drop policy if exists workspace_memberships_insert_personal_owner on workspace.workspace_memberships;
drop policy if exists workspace_entitlements_select_member on workspace.workspace_entitlements;
drop policy if exists audit_events_select_member on workspace.audit_events;

create policy user_profiles_select_self on workspace.user_profiles
  for select to authenticated using (user_id = auth.uid());
create policy user_profiles_insert_self on workspace.user_profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy user_profiles_update_self on workspace.user_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy workspaces_select_member on workspace.workspaces
  for select to authenticated using (workspace_private.is_active_member(id) or owner_user_id = auth.uid());
create policy workspaces_insert_personal_owner on workspace.workspaces
  for insert to authenticated with check (workspace_type = 'personal' and owner_user_id = auth.uid());
create policy workspaces_update_personal_owner on workspace.workspaces
  for update to authenticated
  using (owner_user_id = auth.uid() and workspace_type = 'personal')
  with check (owner_user_id = auth.uid() and workspace_type = 'personal');

create policy workspace_memberships_select_self on workspace.workspace_memberships
  for select to authenticated using (user_id = auth.uid());
create policy workspace_memberships_insert_personal_owner on workspace.workspace_memberships
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and status = 'active'
    and exists (
      select 1
      from workspace.workspaces as workspace_record
      where workspace_record.id = workspace_memberships.workspace_id
        and workspace_record.workspace_type = 'personal'
        and workspace_record.owner_user_id = auth.uid()
    )
  );

create policy workspace_entitlements_select_member on workspace.workspace_entitlements
  for select to authenticated using (workspace_private.is_active_member(workspace_id));

create policy audit_events_select_member on workspace.audit_events
  for select to authenticated using (workspace_private.is_active_member(workspace_id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'integration_connections', 'projects', 'tasks', 'notes', 'meetings', 'decisions',
    'commitments', 'files', 'capture_inbox', 'job_applications', 'memory_entries',
    'ai_conversations', 'daily_briefings', 'knowledge_sources', 'knowledge_items',
    'weekly_feeds', 'weekly_feed_items'
  ]
  loop
    execute format('drop policy if exists %I on workspace.%I', table_name || '_select_member', table_name);
    execute format('drop policy if exists %I on workspace.%I', table_name || '_insert_owner', table_name);
    execute format('drop policy if exists %I on workspace.%I', table_name || '_update_owner', table_name);
    execute format('drop policy if exists %I on workspace.%I', table_name || '_delete_owner', table_name);
    execute format('create policy %I on workspace.%I for select to authenticated using (workspace_private.is_active_member(workspace_id))', table_name || '_select_member', table_name);
    execute format('create policy %I on workspace.%I for insert to authenticated with check (workspace_private.is_workspace_owner(workspace_id) and created_by = auth.uid())', table_name || '_insert_owner', table_name);
    execute format('create policy %I on workspace.%I for update to authenticated using (workspace_private.is_workspace_owner(workspace_id)) with check (workspace_private.is_workspace_owner(workspace_id) and created_by = auth.uid())', table_name || '_update_owner', table_name);
    execute format('create policy %I on workspace.%I for delete to authenticated using (workspace_private.is_workspace_owner(workspace_id))', table_name || '_delete_owner', table_name);
  end loop;
end;
$$;

-- Dedicated private bucket. Files are accessed through Storage APIs only; no
-- application code may manipulate `storage.objects` with direct SQL.
insert into storage.buckets (id, name, public)
values ('workspace-private', 'workspace-private', false)
on conflict (id) do update set public = false;

drop policy if exists workspace_private_objects_select on storage.objects;
create policy workspace_private_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'workspace-private'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and workspace_private.is_active_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists workspace_private_objects_insert on storage.objects;
create policy workspace_private_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'workspace-private'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and workspace_private.is_workspace_owner(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists workspace_private_objects_update on storage.objects;
create policy workspace_private_objects_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'workspace-private'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and workspace_private.is_workspace_owner(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'workspace-private'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and workspace_private.is_workspace_owner(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists workspace_private_objects_delete on storage.objects;
create policy workspace_private_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'workspace-private'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and workspace_private.is_workspace_owner(((storage.foldername(name))[1])::uuid)
  );

comment on schema workspace is 'Lead Emergence Workspace exposed data API schema. Tenant access is enforced by RLS.';
comment on schema workspace_private is 'Lead Emergence Workspace private authorization and trigger schema. It must never be exposed through the Data API.';
comment on table workspace.integration_connections is 'Metadata only. OAuth access tokens, refresh tokens, and client secrets are prohibited.';
