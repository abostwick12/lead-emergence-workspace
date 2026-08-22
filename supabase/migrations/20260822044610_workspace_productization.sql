-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- PURPOSE: Personal product plans, shared onboarding/configuration, Entry SSO
-- provisioning, and an OAuth-isolated Workspace MCP contract.

create table if not exists workspace_private.product_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default now()
);

insert into workspace_private.product_settings (setting_key, setting_value)
values ('mcp_resource_uri', 'https://workspace.leademergence.com/api/mcp')
on conflict (setting_key) do update set setting_value = excluded.setting_value, updated_at = now();

create table if not exists workspace_private.trusted_identity_providers (
  provider_identifier text primary key check (provider_identifier ~ '^custom:[a-z0-9][a-z0-9:-]{1,49}$'),
  environment text not null check (environment in ('development', 'preview', 'production')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

insert into workspace_private.trusted_identity_providers (provider_identifier, environment, enabled)
values
  ('custom:lead-emergence-entry-workspace-dev', 'development', false),
  ('custom:lead-emergence-entry-workspace-preview', 'preview', false),
  ('custom:lead-emergence-entry-workspace-prod', 'production', true)
on conflict (provider_identifier) do update set
  environment = excluded.environment,
  enabled = excluded.enabled;

alter table workspace.user_profiles
  add column if not exists canonical_user_id uuid,
  add column if not exists entry_provider text;

-- The foundation already attaches the shared updated-at trigger to memberships.
-- Add the matching column before provisioning can safely reactivate an owner.
alter table workspace.workspace_memberships
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists workspace_user_profiles_canonical_user_id_unique
  on workspace.user_profiles (canonical_user_id)
  where canonical_user_id is not null;

alter table workspace.user_profiles drop constraint if exists workspace_user_profiles_entry_provider_check;
alter table workspace.user_profiles
  add constraint workspace_user_profiles_entry_provider_check
  check (entry_provider is null or entry_provider ~ '^custom:[a-z0-9][a-z0-9:-]{1,49}$');

create table if not exists workspace.plan_definitions (
  plan_key text primary key check (plan_key ~ '^[a-z][a-z0-9_]{1,49}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  description text not null check (char_length(description) between 1 and 500),
  commercial_status text not null default 'unpriced' check (commercial_status in ('unpriced', 'active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace.capability_catalog (
  capability_key text primary key check (capability_key ~ '^[a-z][a-z0-9_]{1,79}$'),
  display_name text not null check (char_length(display_name) between 1 and 100),
  benefit_description text not null check (char_length(benefit_description) between 1 and 500),
  value_type text not null default 'boolean' check (value_type in ('boolean', 'integer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace.plan_capabilities (
  plan_key text not null references workspace.plan_definitions(plan_key) on delete cascade,
  capability_key text not null references workspace.capability_catalog(capability_key) on delete cascade,
  enabled boolean not null default false,
  limit_value integer check (limit_value is null or limit_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_key, capability_key)
);

insert into workspace.plan_definitions (plan_key, display_name, description)
values ('personal', 'Personal', 'A private leadership Workspace for seeing reality, choosing intentionally, and learning from what changes.')
on conflict (plan_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  updated_at = now();

insert into workspace.capability_catalog (capability_key, display_name, benefit_description, value_type)
values
  ('core_workspace', 'Core Workspace', 'Keep personal leadership context, commitments, and decisions in one private system.', 'boolean'),
  ('tasks', 'Daily Focus', 'Turn commitments into a clear, editable daily focus.', 'boolean'),
  ('quick_capture', 'Quick Capture', 'Capture a signal before deciding what it means or where it belongs.', 'boolean'),
  ('memory', 'Personal Memory', 'Retain confirmed context that can improve future assistance.', 'boolean'),
  ('career', 'Career Pipeline', 'Track opportunities and the next useful action without losing context.', 'boolean'),
  ('daily_brief', 'Daily Brief', 'Configure a leadership-oriented review of priorities, commitments, and change.', 'boolean'),
  ('workspace_mcp', 'AI Assistant Connection', 'Use ChatGPT or Claude as an authorized interface to this Workspace.', 'boolean'),
  ('leader_mode', 'Leader Mode', 'Add higher-level leadership synthesis when separately enabled for this Workspace.', 'boolean'),
  ('external_connectors', 'External Connections', 'Connect approved external systems with explicit consent.', 'boolean'),
  ('advanced_mcp', 'Advanced AI Tools', 'Use an expanded set of assistant tools and resources.', 'boolean'),
  ('agentic_workflows', 'Agentic Workflows', 'Run bounded multi-step assistant workflows.', 'boolean'),
  ('advanced_automation', 'Advanced Automation', 'Run approved automations while retaining their saved configuration.', 'boolean'),
  ('integration_limit', 'Connection Limit', 'The number of external systems that may be connected at one time.', 'integer')
on conflict (capability_key) do update set
  display_name = excluded.display_name,
  benefit_description = excluded.benefit_description,
  value_type = excluded.value_type,
  updated_at = now();

insert into workspace.plan_capabilities (plan_key, capability_key, enabled, limit_value)
values
  ('personal', 'core_workspace', true, null),
  ('personal', 'tasks', true, null),
  ('personal', 'quick_capture', true, null),
  ('personal', 'memory', true, null),
  ('personal', 'career', true, null),
  ('personal', 'daily_brief', true, null),
  ('personal', 'workspace_mcp', true, null),
  ('personal', 'leader_mode', false, null),
  ('personal', 'external_connectors', false, null),
  ('personal', 'advanced_mcp', false, null),
  ('personal', 'agentic_workflows', false, null),
  ('personal', 'advanced_automation', false, null),
  ('personal', 'integration_limit', true, 0)
on conflict (plan_key, capability_key) do update set
  enabled = excluded.enabled,
  limit_value = excluded.limit_value,
  updated_at = now();

create table if not exists workspace.personal_plans (
  workspace_id uuid primary key references workspace.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_key text not null references workspace.plan_definitions(plan_key) on delete restrict,
  status text not null default 'active' check (status in ('active', 'suspended')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  trial_capabilities jsonb,
  conversion_state text,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists workspace.personal_onboarding (
  workspace_id uuid primary key references workspace.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null default 'setup_method_required' check (state in (
    'setup_method_required', 'ai_setup_selected', 'mcp_connection_required', 'mcp_connected',
    'onboarding_in_progress', 'onboarding_complete', 'workspace_ready'
  )),
  setup_method text check (setup_method is null or setup_method in ('ai', 'native')),
  selected_assistant text check (selected_assistant is null or selected_assistant in ('chatgpt', 'claude')),
  completed_areas text[] not null default '{}',
  started_at timestamptz,
  completed_at timestamptz,
  last_resumed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists workspace.personal_configuration_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  area text not null check (area in (
    'responsibilities', 'areas_of_attention', 'priorities', 'commitments', 'value_focus',
    'existing_systems', 'assistant_posture', 'review_rhythm', 'starting_capabilities',
    'daily_brief', 'integration_recommendations'
  )),
  content jsonb not null,
  epistemic_status text not null check (epistemic_status in (
    'user_reported', 'ai_suggested', 'user_confirmed', 'validated_configuration'
  )),
  source_interface text not null check (source_interface in ('chatgpt', 'claude', 'native', 'system')),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personal_configuration_workspace_area_idx
  on workspace.personal_configuration_items (workspace_id, area, active, updated_at desc);

create table if not exists workspace.mcp_authorizations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  client_id text not null check (char_length(client_id) between 1 and 500),
  assistant_provider text not null check (assistant_provider in ('chatgpt', 'claude', 'other')),
  status text not null default 'connecting' check (status in (
    'connecting', 'connected', 'reconnect_required', 'error', 'disconnected', 'disabled', 'not_included'
  )),
  granted_scopes text[] not null default '{}',
  connected_at timestamptz,
  disconnected_at timestamptz,
  authorization_valid_after timestamptz,
  last_verified_at timestamptz,
  last_error_code text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, client_id)
);

create table if not exists workspace.product_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  event_name text not null check (event_name in (
    'onboarding_started', 'ai_setup_selected', 'native_setup_selected', 'mcp_connected',
    'mcp_disconnected', 'onboarding_completed', 'workspace_configured',
    'integration_connected', 'feature_locked_seen', 'plan_viewed', 'first_capture_created'
  )),
  event_context jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists product_events_workspace_created_idx
  on workspace.product_events (workspace_id, created_at desc);

create table if not exists workspace_private.plan_assignment_audit (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references workspace.workspaces(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  previous_plan_key text,
  next_plan_key text not null references workspace.plan_definitions(plan_key) on delete restrict,
  reason text not null check (char_length(reason) between 5 and 500),
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create or replace function workspace_private.is_direct_session()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and nullif(auth.jwt() ->> 'client_id', '') is null
    and coalesce(auth.jwt() ->> 'workspace_mcp', 'false') <> 'true';
$$;

create or replace function workspace_private.is_active_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select workspace_private.is_direct_session()
    and exists (
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
  select workspace_private.is_direct_session()
    and exists (
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

create or replace function workspace_private.has_personal_capability(target_workspace_id uuid, target_capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select plan_capability.enabled
      from workspace.personal_plans as personal_plan
      join workspace.plan_capabilities as plan_capability
        on plan_capability.plan_key = personal_plan.plan_key
      where personal_plan.workspace_id = target_workspace_id
        and personal_plan.user_id = auth.uid()
        and personal_plan.status = 'active'
        and plan_capability.capability_key = target_capability
    ), false
  ) or (
    target_capability = 'leader_mode'
    and exists (
      select 1 from workspace.personal_plans as owner_plan
      where owner_plan.workspace_id = target_workspace_id
        and owner_plan.user_id = auth.uid()
        and owner_plan.status = 'active'
    )
    and exists (
      select 1 from workspace.workspace_entitlements as entitlement
      where entitlement.workspace_id = target_workspace_id
        and entitlement.feature_key = 'leader_mode'
        and entitlement.enabled
        and (entitlement.expires_at is null or entitlement.expires_at > now())
    )
  );
$$;

create or replace function workspace_private.is_valid_mcp_request()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and nullif(auth.jwt() ->> 'client_id', '') is not null
    and coalesce(auth.jwt() ->> 'workspace_mcp', 'false') = 'true'
    and auth.jwt() ->> 'aud' = (
      select setting_value
      from workspace_private.product_settings
      where setting_key = 'mcp_resource_uri'
    );
$$;

create or replace function workspace_private.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  resource_uri text;
begin
  claims := event -> 'claims';
  if nullif(claims ->> 'client_id', '') is not null then
    select setting_value into resource_uri
    from workspace_private.product_settings
    where setting_key = 'mcp_resource_uri';
    claims := pg_catalog.jsonb_set(claims, '{aud}', pg_catalog.to_jsonb(resource_uri), true);
    claims := pg_catalog.jsonb_set(claims, '{workspace_mcp}', 'true'::jsonb, true);
    event := pg_catalog.jsonb_set(event, '{claims}', claims, true);
  end if;
  return event;
end;
$$;

revoke all on function workspace_private.is_direct_session() from public, anon, authenticated;
revoke all on function workspace_private.has_personal_capability(uuid, text) from public, anon, authenticated;
revoke all on function workspace_private.is_valid_mcp_request() from public, anon, authenticated;
revoke all on function workspace_private.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function workspace_private.is_direct_session() to authenticated;
grant execute on function workspace_private.has_personal_capability(uuid, text) to authenticated;
grant execute on function workspace_private.is_valid_mcp_request() to authenticated;
grant usage on schema workspace_private to supabase_auth_admin;
grant execute on function workspace_private.custom_access_token_hook(jsonb) to supabase_auth_admin;

create or replace function workspace_private.assign_personal_plan(
  target_workspace_id uuid,
  target_plan_key text,
  change_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  previous_plan text;
begin
  if char_length(trim(change_reason)) not between 5 and 500 then
    raise exception 'A concise plan-change reason is required.' using errcode = '22023';
  end if;
  if not exists (select 1 from workspace.plan_definitions where plan_key = target_plan_key) then
    raise exception 'Unknown Personal plan.' using errcode = '22023';
  end if;
  select user_id, plan_key into target_user_id, previous_plan
  from workspace.personal_plans
  where workspace_id = target_workspace_id
  for update;
  if target_user_id is null then
    raise exception 'Personal plan assignment not found.' using errcode = '22023';
  end if;
  update workspace.personal_plans set
    plan_key = target_plan_key,
    status = 'active',
    updated_at = now()
  where workspace_id = target_workspace_id;
  insert into workspace_private.plan_assignment_audit (
    workspace_id, user_id, previous_plan_key, next_plan_key, reason, changed_by
  ) values (
    target_workspace_id, target_user_id, previous_plan, target_plan_key, trim(change_reason), auth.uid()
  );
end;
$$;

revoke all on workspace_private.product_settings, workspace_private.trusted_identity_providers,
  workspace_private.plan_assignment_audit from public, anon, authenticated;
revoke all on function workspace_private.assign_personal_plan(uuid, text, text) from public, anon, authenticated;
grant usage on schema workspace_private to service_role;
grant execute on function workspace_private.assign_personal_plan(uuid, text, text) to service_role;

create or replace function workspace.ensure_personal_workspace()
returns setof workspace.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  existing_workspace workspace.workspaces%rowtype;
  provider_count integer;
  provider_identifier text;
  canonical_subject text;
  profile_name text;
begin
  if caller_id is null or not workspace_private.is_direct_session() then
    raise exception 'A direct authenticated Workspace session is required.' using errcode = '42501';
  end if;

  select * into existing_workspace
  from workspace.workspaces
  where workspace_type = 'personal' and owner_user_id = caller_id
  limit 1;

  select count(*), min(identity.provider), min(identity.identity_data ->> 'sub')
    into provider_count, provider_identifier, canonical_subject
  from auth.identities as identity
  join workspace_private.trusted_identity_providers as trusted
    on trusted.provider_identifier = identity.provider and trusted.enabled
  where identity.user_id = caller_id
    and identity.identity_data ->> 'sub' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

  if existing_workspace.id is null then
    if provider_count <> 1 then
      raise exception 'A single verified Lead Emergence Entry identity is required.' using errcode = '42501';
    end if;

    select coalesce(
      nullif(raw_user_meta_data ->> 'full_name', ''),
      nullif(raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(email, 'Personal'), '@', 1),
      'Personal'
    ) into profile_name
    from auth.users where id = caller_id;

    insert into workspace.user_profiles (user_id, display_name, canonical_user_id, entry_provider)
    values (caller_id, left(profile_name, 160), canonical_subject::uuid, provider_identifier)
    on conflict (user_id) do update set
      display_name = coalesce(workspace.user_profiles.display_name, excluded.display_name),
      canonical_user_id = excluded.canonical_user_id,
      entry_provider = excluded.entry_provider,
      updated_at = now();

    insert into workspace.workspaces (workspace_type, name, owner_user_id)
    values ('personal', left(profile_name || '''s Workspace', 160), caller_id)
    returning * into existing_workspace;

    insert into workspace.workspace_memberships (workspace_id, user_id, role, status)
    values (existing_workspace.id, caller_id, 'owner', 'active');
  else
    if not exists (
      select 1 from workspace.workspace_memberships as membership
      where membership.workspace_id = existing_workspace.id
        and membership.user_id = caller_id
        and membership.role = 'owner'
        and membership.status = 'active'
    ) then
      raise exception 'Personal Workspace authorization is not active.' using errcode = '42501';
    end if;

    if provider_count > 1 then
      raise exception 'A single verified Lead Emergence Entry identity is required.' using errcode = '42501';
    end if;
    if provider_count = 1 and exists (
      select 1 from workspace.user_profiles as existing_profile
      where existing_profile.user_id = caller_id
        and existing_profile.canonical_user_id is not null
        and existing_profile.canonical_user_id <> canonical_subject::uuid
    ) then
      raise exception 'The Personal Workspace is already linked to a different Lead Emergence identity.' using errcode = '42501';
    end if;

    insert into workspace.user_profiles (user_id, display_name, canonical_user_id, entry_provider)
    values (
      caller_id,
      null,
      case when provider_count = 1 then canonical_subject::uuid else null end,
      case when provider_count = 1 then provider_identifier else null end
    )
    on conflict (user_id) do update set
      canonical_user_id = coalesce(excluded.canonical_user_id, workspace.user_profiles.canonical_user_id),
      entry_provider = coalesce(excluded.entry_provider, workspace.user_profiles.entry_provider),
      updated_at = now();
  end if;

  insert into workspace.personal_plans (workspace_id, user_id, plan_key)
  values (existing_workspace.id, caller_id, 'personal')
  on conflict (workspace_id) do nothing;

  insert into workspace.personal_onboarding (workspace_id, user_id, created_by)
  values (existing_workspace.id, caller_id, caller_id)
  on conflict (workspace_id) do nothing;

  return next existing_workspace;
end;
$$;

create or replace function workspace.complete_personal_onboarding()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_workspace_id uuid;
  confirmed_areas integer;
begin
  if caller_id is null or not workspace_private.is_direct_session() then
    raise exception 'A direct authenticated Workspace session is required.' using errcode = '42501';
  end if;
  select id into target_workspace_id from workspace.workspaces
    where owner_user_id = caller_id and workspace_type = 'personal' limit 1;
  if target_workspace_id is null
    or not workspace_private.is_workspace_owner(target_workspace_id)
    or not workspace_private.has_personal_capability(target_workspace_id, 'core_workspace') then
    raise exception 'Personal Workspace access is not available.' using errcode = '42501';
  end if;
  select count(distinct area) into confirmed_areas
  from workspace.personal_configuration_items
  where workspace_id = target_workspace_id and created_by = caller_id and active
    and epistemic_status in ('user_confirmed', 'validated_configuration');
  if confirmed_areas < 3 then
    raise exception 'Confirm at least three setup areas before completing onboarding.' using errcode = '22023';
  end if;
  update workspace.personal_onboarding set
    state = 'workspace_ready', completed_at = coalesce(completed_at, now()), updated_at = now()
  where workspace_id = target_workspace_id and user_id = caller_id;
  insert into workspace.product_events (workspace_id, event_name, event_context, created_by)
  values (target_workspace_id, 'onboarding_completed', '{"interface":"native"}'::jsonb, caller_id);
  return pg_catalog.jsonb_build_object('workspace_id', target_workspace_id, 'state', 'workspace_ready', 'confirmed_areas', confirmed_areas);
end;
$$;

create or replace function workspace.select_personal_setup_method(target_method text, target_assistant text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  next_state text;
begin
  if auth.uid() is null or not workspace_private.is_direct_session() then
    raise exception 'A direct authenticated Workspace session is required.' using errcode = '42501';
  end if;
  if target_method not in ('ai', 'native')
    or (target_method = 'ai' and target_assistant not in ('chatgpt', 'claude'))
    or (target_method = 'native' and target_assistant is not null) then
    raise exception 'Choose a supported setup method.' using errcode = '22023';
  end if;
  select id into target_workspace_id from workspace.workspaces
  where owner_user_id = auth.uid() and workspace_type = 'personal' limit 1;
  if target_workspace_id is null
    or not workspace_private.is_workspace_owner(target_workspace_id)
    or not workspace_private.has_personal_capability(target_workspace_id, 'core_workspace')
    or (target_method = 'ai' and not workspace_private.has_personal_capability(target_workspace_id, 'workspace_mcp')) then
    raise exception 'This setup method is not available for the current Personal plan.' using errcode = '42501';
  end if;
  next_state := case when target_method = 'ai' then 'mcp_connection_required' else 'onboarding_in_progress' end;
  update workspace.personal_onboarding set
    setup_method = target_method,
    selected_assistant = target_assistant,
    state = next_state,
    started_at = coalesce(started_at, now()),
    last_resumed_at = now(),
    updated_at = now()
  where workspace_id = target_workspace_id and user_id = auth.uid()
    and state not in ('onboarding_complete', 'workspace_ready');
  if not found then
    raise exception 'Completed onboarding cannot be restarted through the setup route.' using errcode = '22023';
  end if;
  insert into workspace.product_events (workspace_id, event_name, event_context, created_by)
  values (
    target_workspace_id,
    case when target_method = 'ai' then 'ai_setup_selected' else 'native_setup_selected' end,
    case when target_assistant is null then '{}'::jsonb else pg_catalog.jsonb_build_object('assistant', target_assistant) end,
    auth.uid()
  );
  return pg_catalog.jsonb_build_object('workspace_id', target_workspace_id, 'state', next_state, 'setup_method', target_method, 'selected_assistant', target_assistant);
end;
$$;

create or replace function workspace.prepare_personal_assistant_connection(target_assistant text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  current_state text;
begin
  if auth.uid() is null or not workspace_private.is_direct_session() then
    raise exception 'A direct authenticated Workspace session is required.' using errcode = '42501';
  end if;
  if target_assistant not in ('chatgpt', 'claude') then
    raise exception 'Choose ChatGPT or Claude.' using errcode = '22023';
  end if;
  select workspace_record.id, onboarding.state into target_workspace_id, current_state
  from workspace.workspaces as workspace_record
  join workspace.personal_onboarding as onboarding on onboarding.workspace_id = workspace_record.id
  where workspace_record.owner_user_id = auth.uid()
    and workspace_record.workspace_type = 'personal'
    and onboarding.user_id = auth.uid()
  limit 1;
  if target_workspace_id is null
    or not workspace_private.is_workspace_owner(target_workspace_id)
    or not workspace_private.has_personal_capability(target_workspace_id, 'workspace_mcp') then
    raise exception 'The AI assistant connection is not included for this Workspace.' using errcode = '42501';
  end if;
  update workspace.personal_onboarding set
    selected_assistant = target_assistant,
    setup_method = case when current_state in ('onboarding_complete', 'workspace_ready') then setup_method else 'ai' end,
    state = case when current_state in ('onboarding_complete', 'workspace_ready') then current_state else 'mcp_connection_required' end,
    last_resumed_at = now(),
    updated_at = now()
  where workspace_id = target_workspace_id and user_id = auth.uid();
  return pg_catalog.jsonb_build_object('workspace_id', target_workspace_id, 'state', current_state, 'selected_assistant', target_assistant);
end;
$$;

create or replace function workspace.disconnect_personal_mcp(target_client_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
begin
  if auth.uid() is null or not workspace_private.is_direct_session() then
    raise exception 'A direct authenticated Workspace session is required.' using errcode = '42501';
  end if;
  select id into target_workspace_id from workspace.workspaces
  where owner_user_id = auth.uid() and workspace_type = 'personal' limit 1;
  update workspace.mcp_authorizations set
    status = 'disconnected',
    disconnected_at = now(),
    authorization_valid_after = now(),
    updated_at = now()
  where workspace_id = target_workspace_id and created_by = auth.uid() and client_id = target_client_id;
  if not found then
    raise exception 'AI assistant authorization not found.' using errcode = '22023';
  end if;
  insert into workspace.product_events (workspace_id, event_name, event_context, created_by)
  values (target_workspace_id, 'mcp_disconnected', '{"client_id_present":true}'::jsonb, auth.uid());
end;
$$;

create or replace function workspace_private.require_mcp_workspace()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  token_client_id text := auth.jwt() ->> 'client_id';
  token_issued_at timestamptz := pg_catalog.to_timestamp((auth.jwt() ->> 'iat')::double precision);
  connection_status text;
  valid_after timestamptz;
begin
  if not workspace_private.is_valid_mcp_request() then
    raise exception 'The MCP authorization is invalid or has the wrong audience.' using errcode = '42501';
  end if;
  select workspace_record.id into target_workspace_id
  from workspace.workspaces as workspace_record
  join workspace.workspace_memberships as membership on membership.workspace_id = workspace_record.id
  where workspace_record.owner_user_id = auth.uid()
    and workspace_record.workspace_type = 'personal'
    and membership.user_id = auth.uid()
    and membership.role = 'owner'
    and membership.status = 'active'
  limit 1;
  if target_workspace_id is null
    or not workspace_private.has_personal_capability(target_workspace_id, 'core_workspace')
    or not workspace_private.has_personal_capability(target_workspace_id, 'workspace_mcp') then
    raise exception 'The AI assistant connection is not included for this Workspace.' using errcode = '42501';
  end if;
  select status, authorization_valid_after into connection_status, valid_after
  from workspace.mcp_authorizations
  where workspace_id = target_workspace_id and client_id = token_client_id;
  if connection_status is distinct from 'connected'
    or token_issued_at is null
    or (valid_after is not null and token_issued_at < valid_after) then
    raise exception 'This AI assistant connection is disconnected or requires authorization.' using errcode = '42501';
  end if;
  return target_workspace_id;
end;
$$;

create or replace function workspace.mcp_register_connection()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  token_client_id text := auth.jwt() ->> 'client_id';
  token_issued_at timestamptz := pg_catalog.to_timestamp((auth.jwt() ->> 'iat')::double precision);
  selected_provider text;
  existing_status text;
  previous_disconnected_at timestamptz;
  previous_valid_after timestamptz;
begin
  if not workspace_private.is_valid_mcp_request() then
    raise exception 'The MCP authorization is invalid or has the wrong audience.' using errcode = '42501';
  end if;
  select workspace_record.id, coalesce(onboarding.selected_assistant, 'other')
    into target_workspace_id, selected_provider
  from workspace.workspaces as workspace_record
  join workspace.workspace_memberships as membership on membership.workspace_id = workspace_record.id
  left join workspace.personal_onboarding as onboarding on onboarding.workspace_id = workspace_record.id
  where workspace_record.owner_user_id = auth.uid()
    and workspace_record.workspace_type = 'personal'
    and membership.user_id = auth.uid()
    and membership.role = 'owner'
    and membership.status = 'active'
  limit 1;
  if target_workspace_id is null
    or not workspace_private.has_personal_capability(target_workspace_id, 'core_workspace')
    or not workspace_private.has_personal_capability(target_workspace_id, 'workspace_mcp') then
    raise exception 'The AI assistant connection is not included for this Workspace.' using errcode = '42501';
  end if;
  if token_issued_at is null then
    raise exception 'The MCP authorization is missing its issuance time.' using errcode = '42501';
  end if;
  select status, disconnected_at, authorization_valid_after
    into existing_status, previous_disconnected_at, previous_valid_after
  from workspace.mcp_authorizations
    where workspace_id = target_workspace_id and client_id = token_client_id;
  if existing_status in ('disabled', 'not_included')
    or (existing_status = 'disconnected' and (previous_disconnected_at is null or token_issued_at <= previous_disconnected_at))
    or (existing_status = 'connected' and previous_valid_after is not null and token_issued_at < previous_valid_after) then
    raise exception 'This AI assistant connection was disconnected.' using errcode = '42501';
  end if;
  insert into workspace.mcp_authorizations (
    workspace_id, client_id, assistant_provider, status, connected_at, authorization_valid_after, last_verified_at, created_by
  ) values (
    target_workspace_id, token_client_id, selected_provider, 'connected', now(), token_issued_at, now(), auth.uid()
  ) on conflict (workspace_id, client_id) do update set
    status = 'connected', connected_at = now(), disconnected_at = null,
    authorization_valid_after = token_issued_at,
    last_verified_at = now(), last_error_code = null, updated_at = now();
  update workspace.personal_onboarding set
    state = case when state in ('onboarding_complete', 'workspace_ready') then state else 'mcp_connected' end,
    setup_method = coalesce(setup_method, 'ai'),
    started_at = coalesce(started_at, now()),
    last_resumed_at = now(),
    updated_at = now()
  where workspace_id = target_workspace_id and user_id = auth.uid();
  if existing_status is null then
    insert into workspace.product_events (workspace_id, event_name, event_context, created_by)
    values (target_workspace_id, 'mcp_connected', pg_catalog.jsonb_build_object('assistant', selected_provider), auth.uid());
  end if;
  return pg_catalog.jsonb_build_object('workspace_id', target_workspace_id, 'status', 'connected', 'assistant', selected_provider);
end;
$$;

create or replace function workspace.mcp_get_onboarding_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_workspace();
  result jsonb;
begin
  select pg_catalog.jsonb_build_object(
    'workspace_id', onboarding.workspace_id,
    'state', onboarding.state,
    'setup_method', onboarding.setup_method,
    'selected_assistant', onboarding.selected_assistant,
    'completed_areas', onboarding.completed_areas,
    'onboarding_complete', onboarding.state in ('onboarding_complete', 'workspace_ready'),
    'next_useful_area', (
      select area from unnest(array[
        'responsibilities','areas_of_attention','commitments','value_focus','existing_systems',
        'assistant_posture','review_rhythm','starting_capabilities'
      ]) as area
      where not (area = any(onboarding.completed_areas)) limit 1
    )
  ) into result
  from workspace.personal_onboarding as onboarding
  where onboarding.workspace_id = target_workspace_id and onboarding.user_id = auth.uid();
  return result;
end;
$$;

create or replace function workspace.mcp_get_workspace_setup()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_workspace();
begin
  return pg_catalog.jsonb_build_object(
    'workspace_id', target_workspace_id,
    'items', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', item.id,
        'area', item.area,
        'content', item.content,
        'epistemic_status', item.epistemic_status,
        'active', item.active,
        'updated_at', item.updated_at
      ) order by item.updated_at desc)
      from workspace.personal_configuration_items as item
      where item.workspace_id = target_workspace_id and item.created_by = auth.uid() and item.active
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function workspace.mcp_save_user_reported_setup(target_area text, reported_text text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_workspace();
  saved_id uuid;
  assistant text;
begin
  if target_area not in ('responsibilities','areas_of_attention','priorities','commitments','value_focus','existing_systems','assistant_posture','review_rhythm','starting_capabilities','daily_brief','integration_recommendations')
    or char_length(trim(reported_text)) not between 1 and 5000 then
    raise exception 'A supported setup area and concise user-reported text are required.' using errcode = '22023';
  end if;
  select coalesce(selected_assistant, 'chatgpt') into assistant
  from workspace.personal_onboarding where workspace_id = target_workspace_id;
  update workspace.personal_configuration_items set active = false, updated_at = now()
  where workspace_id = target_workspace_id and area = target_area
    and epistemic_status = 'user_reported' and active;
  insert into workspace.personal_configuration_items (
    workspace_id, area, content, epistemic_status, source_interface, created_by
  ) values (
    target_workspace_id, target_area, pg_catalog.jsonb_build_object('text', trim(reported_text)),
    'user_reported', assistant, auth.uid()
  ) returning id into saved_id;
  update workspace.personal_onboarding set
    state = 'onboarding_in_progress',
    completed_areas = array(select distinct unnest(completed_areas || array[target_area])),
    last_resumed_at = now(), updated_at = now()
  where workspace_id = target_workspace_id;
  return pg_catalog.jsonb_build_object('id', saved_id, 'area', target_area, 'epistemic_status', 'user_reported');
end;
$$;

create or replace function workspace.mcp_suggest_workspace_configuration(target_area text, suggestion_text text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_workspace();
  saved_id uuid;
  assistant text;
begin
  if target_area not in ('responsibilities','areas_of_attention','priorities','commitments','value_focus','existing_systems','assistant_posture','review_rhythm','starting_capabilities','daily_brief','integration_recommendations')
    or char_length(trim(suggestion_text)) not between 1 and 5000 then
    raise exception 'A supported setup area and concise suggestion are required.' using errcode = '22023';
  end if;
  select coalesce(selected_assistant, 'chatgpt') into assistant
  from workspace.personal_onboarding where workspace_id = target_workspace_id;
  update workspace.personal_configuration_items set active = false, updated_at = now()
  where workspace_id = target_workspace_id and area = target_area
    and epistemic_status = 'ai_suggested' and active;
  insert into workspace.personal_configuration_items (
    workspace_id, area, content, epistemic_status, source_interface, created_by
  ) values (
    target_workspace_id, target_area, pg_catalog.jsonb_build_object('text', trim(suggestion_text)),
    'ai_suggested', assistant, auth.uid()
  ) returning id into saved_id;
  return pg_catalog.jsonb_build_object(
    'id', saved_id, 'area', target_area, 'epistemic_status', 'ai_suggested',
    'requires_user_confirmation', true
  );
end;
$$;

create or replace function workspace.mcp_confirm_workspace_configuration(item_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_workspace();
  updated_count integer;
  confirmed_areas text[];
begin
  if item_ids is null or cardinality(item_ids) < 1 or cardinality(item_ids) > 20 then
    raise exception 'One to twenty configuration item identifiers are required.' using errcode = '22023';
  end if;
  update workspace.personal_configuration_items set
    epistemic_status = 'user_confirmed', confirmed_at = now(), active = true, updated_at = now()
  where workspace_id = target_workspace_id and created_by = auth.uid()
    and id = any(item_ids) and epistemic_status in ('user_reported', 'ai_suggested');
  get diagnostics updated_count = row_count;
  select coalesce(array_agg(distinct area), '{}') into confirmed_areas
  from workspace.personal_configuration_items
  where workspace_id = target_workspace_id and id = any(item_ids)
    and epistemic_status = 'user_confirmed';
  update workspace.personal_onboarding set
    completed_areas = array(select distinct unnest(completed_areas || confirmed_areas)),
    state = 'onboarding_in_progress', updated_at = now()
  where workspace_id = target_workspace_id;
  return pg_catalog.jsonb_build_object('confirmed_count', updated_count, 'confirmed_areas', confirmed_areas);
end;
$$;

create or replace function workspace.mcp_complete_onboarding()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_workspace();
  confirmed_areas integer;
begin
  select count(distinct area) into confirmed_areas
  from workspace.personal_configuration_items
  where workspace_id = target_workspace_id and created_by = auth.uid() and active
    and epistemic_status in ('user_confirmed', 'validated_configuration');
  if confirmed_areas < 3 then
    raise exception 'Confirm at least three setup areas before completing onboarding.' using errcode = '22023';
  end if;
  update workspace.personal_onboarding set
    state = 'workspace_ready', completed_at = coalesce(completed_at, now()), updated_at = now()
  where workspace_id = target_workspace_id and user_id = auth.uid();
  insert into workspace.product_events (workspace_id, event_name, event_context, created_by)
  values (target_workspace_id, 'onboarding_completed', '{"interface":"ai"}'::jsonb, auth.uid());
  return pg_catalog.jsonb_build_object(
    'workspace_id', target_workspace_id,
    'state', 'workspace_ready',
    'confirmed_areas', confirmed_areas,
    'message', 'Workspace now has enough confirmed context to begin helping.'
  );
end;
$$;

create or replace function workspace.mcp_capture_signal(capture_text text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_workspace();
  capture_id uuid;
  onboarding_state text;
begin
  if char_length(trim(capture_text)) not between 1 and 10000 then
    raise exception 'Capture text must be between 1 and 10000 characters.' using errcode = '22023';
  end if;
  if not workspace_private.has_personal_capability(target_workspace_id, 'quick_capture') then
    raise exception 'Quick Capture is not included for this Workspace.' using errcode = '42501';
  end if;
  select state into onboarding_state from workspace.personal_onboarding where workspace_id = target_workspace_id;
  if onboarding_state <> 'workspace_ready' then
    raise exception 'Complete onboarding before using ongoing Workspace tools.' using errcode = '42501';
  end if;
  insert into workspace.capture_inbox (workspace_id, raw_text, created_by)
  values (target_workspace_id, trim(capture_text), auth.uid()) returning id into capture_id;
  insert into workspace.product_events (workspace_id, event_name, event_context, created_by)
  values (target_workspace_id, 'first_capture_created', '{"interface":"mcp"}'::jsonb, auth.uid());
  return pg_catalog.jsonb_build_object('id', capture_id, 'status', 'unprocessed');
end;
$$;

create or replace function workspace.mcp_get_leadership_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_mcp_workspace();
begin
  return pg_catalog.jsonb_build_object(
    'configuration', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('area', area, 'content', content, 'status', epistemic_status))
      from workspace.personal_configuration_items
      where workspace_id = target_workspace_id and active
        and epistemic_status in ('user_confirmed', 'validated_configuration')
    ), '[]'::jsonb),
    'open_tasks', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', id, 'title', title, 'status', status, 'priority', priority, 'due_date', due_date
      ) order by due_date nulls last, created_at desc)
      from workspace.tasks
      where workspace_id = target_workspace_id and status <> 'done'
        and workspace_private.has_personal_capability(target_workspace_id, 'tasks')
      limit 25
    ), '[]'::jsonb),
    'open_commitments', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', id, 'title', title, 'details', details, 'due_date', due_date
      ) order by due_date nulls last, created_at desc)
      from workspace.commitments
      where workspace_id = target_workspace_id and status = 'open'
      limit 25
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function workspace.ensure_personal_workspace() from public, anon;
revoke all on function workspace.complete_personal_onboarding() from public, anon;
revoke all on function workspace.select_personal_setup_method(text, text) from public, anon;
revoke all on function workspace.prepare_personal_assistant_connection(text) from public, anon;
revoke all on function workspace.disconnect_personal_mcp(text) from public, anon;
revoke all on function workspace.mcp_register_connection() from public, anon;
revoke all on function workspace.mcp_get_onboarding_state() from public, anon;
revoke all on function workspace.mcp_get_workspace_setup() from public, anon;
revoke all on function workspace.mcp_save_user_reported_setup(text, text) from public, anon;
revoke all on function workspace.mcp_suggest_workspace_configuration(text, text) from public, anon;
revoke all on function workspace.mcp_confirm_workspace_configuration(uuid[]) from public, anon;
revoke all on function workspace.mcp_complete_onboarding() from public, anon;
revoke all on function workspace.mcp_capture_signal(text) from public, anon;
revoke all on function workspace.mcp_get_leadership_state() from public, anon;
revoke all on function workspace_private.require_mcp_workspace() from public, anon, authenticated;
grant execute on function workspace.ensure_personal_workspace() to authenticated;
grant execute on function workspace.complete_personal_onboarding() to authenticated;
grant execute on function workspace.select_personal_setup_method(text, text) to authenticated;
grant execute on function workspace.prepare_personal_assistant_connection(text) to authenticated;
grant execute on function workspace.disconnect_personal_mcp(text) to authenticated;
grant execute on function workspace.mcp_register_connection() to authenticated;
grant execute on function workspace.mcp_get_onboarding_state() to authenticated;
grant execute on function workspace.mcp_get_workspace_setup() to authenticated;
grant execute on function workspace.mcp_save_user_reported_setup(text, text) to authenticated;
grant execute on function workspace.mcp_suggest_workspace_configuration(text, text) to authenticated;
grant execute on function workspace.mcp_confirm_workspace_configuration(uuid[]) to authenticated;
grant execute on function workspace.mcp_complete_onboarding() to authenticated;
grant execute on function workspace.mcp_capture_signal(text) to authenticated;
grant execute on function workspace.mcp_get_leadership_state() to authenticated;

alter table workspace.plan_definitions enable row level security;
alter table workspace.capability_catalog enable row level security;
alter table workspace.plan_capabilities enable row level security;
alter table workspace.personal_plans enable row level security;
alter table workspace.personal_onboarding enable row level security;
alter table workspace.personal_configuration_items enable row level security;
alter table workspace.mcp_authorizations enable row level security;
alter table workspace.product_events enable row level security;

revoke all on workspace.plan_definitions, workspace.capability_catalog, workspace.plan_capabilities,
  workspace.personal_plans, workspace.personal_onboarding, workspace.personal_configuration_items,
  workspace.mcp_authorizations, workspace.product_events from public, anon;
grant select on workspace.plan_definitions, workspace.capability_catalog, workspace.plan_capabilities to authenticated;
grant select on workspace.personal_plans to authenticated;
grant select on workspace.personal_onboarding to authenticated;
grant select, insert, update, delete on workspace.personal_configuration_items to authenticated;
grant select on workspace.mcp_authorizations to authenticated;
grant select, insert on workspace.product_events to authenticated;

create policy plan_definitions_select_direct on workspace.plan_definitions
  for select to authenticated using (workspace_private.is_direct_session());
create policy capability_catalog_select_direct on workspace.capability_catalog
  for select to authenticated using (workspace_private.is_direct_session());
create policy plan_capabilities_select_direct on workspace.plan_capabilities
  for select to authenticated using (workspace_private.is_direct_session());
create policy personal_plans_select_owner on workspace.personal_plans
  for select to authenticated using (user_id = auth.uid() and workspace_private.is_workspace_owner(workspace_id));
create policy personal_onboarding_select_owner on workspace.personal_onboarding
  for select to authenticated using (user_id = auth.uid() and workspace_private.is_workspace_owner(workspace_id));
create policy personal_configuration_select_owner on workspace.personal_configuration_items
  for select to authenticated using (created_by = auth.uid() and workspace_private.is_workspace_owner(workspace_id));
create policy personal_configuration_insert_owner on workspace.personal_configuration_items
  for insert to authenticated with check (
    created_by = auth.uid() and workspace_private.is_workspace_owner(workspace_id)
    and workspace_private.has_personal_capability(workspace_id, 'core_workspace')
  );
create policy personal_configuration_update_owner on workspace.personal_configuration_items
  for update to authenticated using (
    created_by = auth.uid() and workspace_private.is_workspace_owner(workspace_id)
    and workspace_private.has_personal_capability(workspace_id, 'core_workspace')
  )
  with check (
    created_by = auth.uid() and workspace_private.is_workspace_owner(workspace_id)
    and workspace_private.has_personal_capability(workspace_id, 'core_workspace')
  );
create policy personal_configuration_delete_owner on workspace.personal_configuration_items
  for delete to authenticated using (
    created_by = auth.uid() and workspace_private.is_workspace_owner(workspace_id)
    and workspace_private.has_personal_capability(workspace_id, 'core_workspace')
  );
create policy mcp_authorizations_select_owner on workspace.mcp_authorizations
  for select to authenticated using (created_by = auth.uid() and workspace_private.is_workspace_owner(workspace_id));
create policy product_events_select_owner on workspace.product_events
  for select to authenticated using (created_by = auth.uid() and workspace_private.is_workspace_owner(workspace_id));
create policy product_events_insert_owner on workspace.product_events
  for insert to authenticated with check (
    created_by = auth.uid() and workspace_private.is_workspace_owner(workspace_id)
    and workspace_private.has_personal_capability(workspace_id, 'core_workspace')
    and event_context - array['content','text','token','access_token','refresh_token','secret'] = event_context
  );

-- Plan capabilities govern writes while ownership/RLS continues to govern
-- reads. A downgrade therefore disables privileged use without deleting or
-- reassigning the user's retained data.
do $$
declare
  mapping record;
begin
  for mapping in
    select * from (values
      ('projects', 'core_workspace'),
      ('tasks', 'tasks'),
      ('notes', 'core_workspace'),
      ('meetings', 'core_workspace'),
      ('decisions', 'core_workspace'),
      ('commitments', 'core_workspace'),
      ('files', 'core_workspace'),
      ('capture_inbox', 'quick_capture'),
      ('job_applications', 'career'),
      ('memory_entries', 'memory'),
      ('ai_conversations', 'core_workspace'),
      ('daily_briefings', 'daily_brief'),
      ('knowledge_sources', 'core_workspace'),
      ('knowledge_items', 'core_workspace'),
      ('weekly_feeds', 'core_workspace'),
      ('weekly_feed_items', 'core_workspace')
    ) as capability_map(table_name, capability_key)
  loop
    execute format('drop policy if exists %I on workspace.%I', mapping.table_name || '_insert_owner', mapping.table_name);
    execute format('drop policy if exists %I on workspace.%I', mapping.table_name || '_update_owner', mapping.table_name);
    execute format('drop policy if exists %I on workspace.%I', mapping.table_name || '_delete_owner', mapping.table_name);
    execute format(
      'create policy %I on workspace.%I for insert to authenticated with check (workspace_private.is_workspace_owner(workspace_id) and workspace_private.has_personal_capability(workspace_id, %L) and created_by = auth.uid())',
      mapping.table_name || '_insert_owner', mapping.table_name, mapping.capability_key
    );
    execute format(
      'create policy %I on workspace.%I for update to authenticated using (workspace_private.is_workspace_owner(workspace_id) and workspace_private.has_personal_capability(workspace_id, %L)) with check (workspace_private.is_workspace_owner(workspace_id) and workspace_private.has_personal_capability(workspace_id, %L) and created_by = auth.uid())',
      mapping.table_name || '_update_owner', mapping.table_name, mapping.capability_key, mapping.capability_key
    );
    execute format(
      'create policy %I on workspace.%I for delete to authenticated using (workspace_private.is_workspace_owner(workspace_id) and workspace_private.has_personal_capability(workspace_id, %L))',
      mapping.table_name || '_delete_owner', mapping.table_name, mapping.capability_key
    );
  end loop;
end;
$$;

-- External connector state is metadata-only in this release. Future adapters
-- must use a separately reviewed controlled server path rather than permitting
-- clients to manufacture connection state directly.
revoke insert, update, delete on workspace.integration_connections from authenticated;

drop policy if exists workspace_private_objects_insert on storage.objects;
create policy workspace_private_objects_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'workspace-private'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and workspace_private.is_workspace_owner(((storage.foldername(name))[1])::uuid)
    and workspace_private.has_personal_capability(((storage.foldername(name))[1])::uuid, 'core_workspace')
  );

drop policy if exists workspace_private_objects_update on storage.objects;
create policy workspace_private_objects_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'workspace-private'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and workspace_private.is_workspace_owner(((storage.foldername(name))[1])::uuid)
    and workspace_private.has_personal_capability(((storage.foldername(name))[1])::uuid, 'core_workspace')
  )
  with check (
    bucket_id = 'workspace-private'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and workspace_private.is_workspace_owner(((storage.foldername(name))[1])::uuid)
    and workspace_private.has_personal_capability(((storage.foldername(name))[1])::uuid, 'core_workspace')
  );

drop policy if exists workspace_private_objects_delete on storage.objects;
create policy workspace_private_objects_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'workspace-private'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and workspace_private.is_workspace_owner(((storage.foldername(name))[1])::uuid)
    and workspace_private.has_personal_capability(((storage.foldername(name))[1])::uuid, 'core_workspace')
  );

drop policy if exists user_profiles_select_self on workspace.user_profiles;
drop policy if exists user_profiles_insert_self on workspace.user_profiles;
drop policy if exists user_profiles_update_self on workspace.user_profiles;
create policy user_profiles_select_self on workspace.user_profiles
  for select to authenticated using (workspace_private.is_direct_session() and user_id = auth.uid());
create policy user_profiles_insert_self on workspace.user_profiles
  for insert to authenticated with check (
    workspace_private.is_direct_session() and user_id = auth.uid()
    and canonical_user_id is null and entry_provider is null
  );
create policy user_profiles_update_self on workspace.user_profiles
  for update to authenticated using (workspace_private.is_direct_session() and user_id = auth.uid())
  with check (workspace_private.is_direct_session() and user_id = auth.uid());

drop policy if exists workspaces_select_member on workspace.workspaces;
drop policy if exists workspaces_insert_personal_owner on workspace.workspaces;
drop policy if exists workspaces_update_personal_owner on workspace.workspaces;
create policy workspaces_select_member on workspace.workspaces
  for select to authenticated using (
    workspace_private.is_direct_session()
    and (workspace_private.is_active_member(id) or owner_user_id = auth.uid())
  );
create policy workspaces_insert_personal_owner on workspace.workspaces
  for insert to authenticated with check (
    workspace_private.is_direct_session() and workspace_type = 'personal' and owner_user_id = auth.uid()
  );
create policy workspaces_update_personal_owner on workspace.workspaces
  for update to authenticated
  using (workspace_private.is_direct_session() and owner_user_id = auth.uid() and workspace_type = 'personal')
  with check (workspace_private.is_direct_session() and owner_user_id = auth.uid() and workspace_type = 'personal');

drop policy if exists workspace_memberships_select_self on workspace.workspace_memberships;
drop policy if exists workspace_memberships_insert_personal_owner on workspace.workspace_memberships;
create policy workspace_memberships_select_self on workspace.workspace_memberships
  for select to authenticated using (workspace_private.is_direct_session() and user_id = auth.uid());
create policy workspace_memberships_insert_personal_owner on workspace.workspace_memberships
  for insert to authenticated with check (
    workspace_private.is_direct_session()
    and user_id = auth.uid() and role = 'owner' and status = 'active'
    and exists (
      select 1 from workspace.workspaces as workspace_record
      where workspace_record.id = workspace_memberships.workspace_id
        and workspace_record.workspace_type = 'personal'
        and workspace_record.owner_user_id = auth.uid()
    )
  );

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'plan_definitions', 'capability_catalog', 'plan_capabilities', 'personal_plans',
    'personal_onboarding', 'personal_configuration_items', 'mcp_authorizations'
  ] loop
    execute format('drop trigger if exists %I on workspace.%I', table_name || '_set_updated_at', table_name);
    execute format(
      'create trigger %I before update on workspace.%I for each row execute function workspace_private.set_updated_at()',
      table_name || '_set_updated_at', table_name
    );
  end loop;
  foreach table_name in array array['personal_onboarding', 'personal_configuration_items', 'mcp_authorizations'] loop
    execute format('drop trigger if exists %I on workspace.%I', table_name || '_audit_mutation', table_name);
    execute format(
      'create trigger %I after insert or update or delete on workspace.%I for each row execute function workspace_private.audit_workspace_mutation()',
      table_name || '_audit_mutation', table_name
    );
  end loop;
end;
$$;

comment on table workspace.personal_configuration_items is
  'The single Personal configuration model used by both native and AI-assisted onboarding. Epistemic status prevents AI suggestions from becoming user truth without confirmation.';
comment on table workspace.mcp_authorizations is
  'Metadata-only MCP authorization state. OAuth access and refresh tokens remain in Supabase Auth and are never stored here.';
comment on table workspace.personal_plans is
  'Product capability packaging only. Plan assignment never grants record access and never bypasses RLS.';
comment on function workspace.ensure_personal_workspace() is
  'Atomically provisions a caller-owned Personal Workspace only after exact Entry OIDC identity verification, while preserving existing legacy owners.';
comment on function workspace_private.custom_access_token_hook(jsonb) is
  'Binds Supabase OAuth-server tokens to the canonical Workspace MCP resource. Direct application sessions are left unchanged.';
