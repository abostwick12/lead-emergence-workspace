-- P2: shared bundle authority and a read-only Writing resource boundary.
-- This migration defines catalog data only; it assigns no client entitlement.
insert into workspace.bundle_definitions(bundle_key, display_name, description)
values ('writer_editor', 'Writer & Editor', 'Review writing resources, their provenance, and what needs attention before publication.')
on conflict (bundle_key) do nothing;

insert into workspace.capability_catalog(capability_key, display_name, benefit_description)
values
  ('writer_resource_library', 'Writing resource library', 'Find and inspect resources in your private Writing library.'),
  ('writer_resource_review', 'Writing resource review', 'See the evidence and missing information behind an editorial review.')
on conflict (capability_key) do nothing;
insert into workspace.bundle_capabilities(bundle_key, capability_key)
values ('writer_editor', 'writer_resource_library'), ('writer_editor', 'writer_resource_review')
on conflict (bundle_key, capability_key) do nothing;

-- Keep existing underscore database identifiers compatible with portable IDs.
create table workspace_private.bundle_capability_bindings (
  bundle_key text not null,
  capability_key text not null,
  runtime_capability_id text not null check (runtime_capability_id ~ '^[a-z][a-z0-9._-]{2,99}$'),
  primary key (bundle_key, capability_key),
  unique (bundle_key, runtime_capability_id),
  foreign key (bundle_key, capability_key) references workspace.bundle_capabilities(bundle_key, capability_key) on delete cascade
);
alter table workspace_private.bundle_capability_bindings enable row level security;
revoke all on workspace_private.bundle_capability_bindings from public, anon, authenticated;
insert into workspace_private.bundle_capability_bindings values
  ('writer_editor', 'writer_resource_library', 'writer.resource.library'),
  ('writer_editor', 'writer_resource_review', 'writer.resource.review');

create function workspace_private.require_bundle_workspace()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare target_workspace uuid;
begin
  if auth.uid() is null then
    raise exception 'Workspace authentication is required.' using errcode = '42501';
  end if;
  if auth.jwt() ->> 'client_id' is not null then
    target_workspace := workspace_private.require_mcp_workspace();
  else
    if not workspace_private.is_direct_session() then
      raise exception 'Workspace authentication is required.' using errcode = '42501';
    end if;
    select w.id into target_workspace from workspace.workspaces w
    join workspace.workspace_memberships m on m.workspace_id = w.id
    where w.owner_user_id = auth.uid() and w.workspace_type = 'personal'
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'
    order by w.created_at, w.id limit 1;
  end if;
  if target_workspace is null
    or not workspace_private.has_personal_capability(target_workspace, 'core_workspace') then
    raise exception 'An active Personal Workspace is required.' using errcode = '42501';
  end if;
  return target_workspace;
end; $$;

create function workspace_private.bundle_capability_active(target_workspace uuid, target_bundle text, runtime_capability text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from workspace.bundle_entitlements e
    join workspace.bundle_definitions d using (bundle_key)
    join workspace.bundle_capabilities c using (bundle_key)
    join workspace_private.bundle_capability_bindings b using (bundle_key, capability_key)
    where e.workspace_id = target_workspace and e.beneficiary_user_id = auth.uid()
      and e.bundle_key = target_bundle and d.availability_status = 'active'
      and e.starts_at <= now() and e.revoked_at is null
      and (e.expires_at is null or e.expires_at > now())
      and c.enabled and b.runtime_capability_id = runtime_capability
  );
$$;

create function workspace.get_bundle_experience()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  target_workspace uuid := workspace_private.require_bundle_workspace();
  assignments jsonb;
  capabilities jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'bundleKey', e.bundle_key,
    'status', case when d.availability_status <> 'active' then 'unavailable'
      when e.revoked_at is not null then 'revoked'
      when e.expires_at is not null and e.expires_at <= now() then 'expired' else 'active' end,
    'startsAt', e.starts_at,
    'expiresAt', e.expires_at
  ) order by e.bundle_key), '[]'::jsonb)
  into assignments from (
    select distinct on (bundle_key) * from workspace.bundle_entitlements
    where workspace_id = target_workspace and beneficiary_user_id = auth.uid()
    order by bundle_key, (revoked_at is null) desc, created_at desc, id desc
  ) e join workspace.bundle_definitions d using (bundle_key);

  select coalesce(jsonb_agg(jsonb_build_object(
    'bundleKey', b.bundle_key, 'capabilityId', b.runtime_capability_id
  ) order by b.bundle_key, b.runtime_capability_id), '[]'::jsonb)
  into capabilities from workspace_private.bundle_capability_bindings b
  where workspace_private.bundle_capability_active(target_workspace, b.bundle_key, b.runtime_capability_id);

  return jsonb_build_object(
    'schemaVersion', '1.0', 'subjectId', auth.uid(), 'workspaceId', target_workspace,
    'resolvedAt', now(),
    'revision', md5(target_workspace::text || auth.uid()::text || assignments::text || capabilities::text),
    'assignments', assignments, 'capabilities', capabilities
  );
end; $$;

-- Domain-private table: even an entitled user or MCP bearer cannot select it
-- directly. All reads go through bounded, identity-derived RPCs.
create table workspace_private.writing_resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 240),
  author text check (char_length(author) <= 240),
  resource_type text not null default 'article' check (resource_type in ('article', 'sermon', 'teaching', 'study_guide', 'other')),
  audience text check (char_length(audience) <= 300),
  topics text[] not null default '{}' check (cardinality(topics) <= 30),
  abstract text check (char_length(abstract) <= 3000),
  body_text text not null default '' check (char_length(body_text) <= 100000),
  source_url text check (source_url is null or source_url ~ '^https?://[^[:space:]]+$'),
  source_label text not null check (char_length(trim(source_label)) between 1 and 240),
  source_date date,
  retrieved_at timestamptz not null default now(),
  epistemic_state text not null default 'user_stated'
    check (epistemic_state in ('observed','user_stated','inferred','suggested','hypothesized','confirmed','rejected','stale')),
  publication_state text not null default 'draft'
    check (publication_state in ('draft','in_review','ready','published','archived')),
  updated_at timestamptz not null default now()
);
create index writing_resources_workspace_updated_idx on workspace_private.writing_resources(workspace_id, updated_at desc, id);
alter table workspace_private.writing_resources enable row level security;
revoke all on workspace_private.writing_resources from public, anon, authenticated;

create function workspace_private.require_writing_capability(runtime_capability text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare target_workspace uuid := workspace_private.require_bundle_workspace();
begin
  if not workspace_private.bundle_capability_active(target_workspace, 'writer_editor', runtime_capability) then
    raise exception 'Active Writer & Editor access is required.' using errcode = '42501';
  end if;
  return target_workspace;
end; $$;

create function workspace.writer_list_resources(search_text text default '', publication_filter text default null, page_offset integer default 0, page_size integer default 25)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare target_workspace uuid := workspace_private.require_writing_capability('writer.resource.library');
begin
  if search_text is null or char_length(search_text) > 200 or page_offset is null or page_offset not between 0 and 10000
    or page_size is null or page_size not between 1 and 50
    or (publication_filter is not null and publication_filter not in ('draft','in_review','ready','published','archived')) then
    raise exception 'Invalid resource search.' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'workspaceId', target_workspace, 'retrievedAt', now(),
    'total', (select count(*) from workspace_private.writing_resources r where r.workspace_id = target_workspace),
    'awaitingPublication', (select count(*) from workspace_private.writing_resources r where r.workspace_id = target_workspace and r.publication_state in ('in_review','ready')),
    'matchingCount', (select count(*) from workspace_private.writing_resources r where r.workspace_id = target_workspace
      and (publication_filter is null or r.publication_state = publication_filter)
      and (trim(search_text) = '' or strpos(lower(r.title || ' ' || coalesce(r.author,'') || ' ' || array_to_string(r.topics,' ')), lower(trim(search_text))) > 0)),
    'resources', coalesce((select jsonb_agg(to_jsonb(page) order by page.updated_at desc, page.id) from (
      select r.id, r.title, r.author, r.resource_type, r.audience, r.topics, r.abstract,
        r.source_url, r.source_label, r.source_date, r.retrieved_at, r.epistemic_state, r.publication_state, r.updated_at
      from workspace_private.writing_resources r where r.workspace_id = target_workspace
        and (publication_filter is null or r.publication_state = publication_filter)
        and (trim(search_text) = '' or strpos(lower(r.title || ' ' || coalesce(r.author,'') || ' ' || array_to_string(r.topics,' ')), lower(trim(search_text))) > 0)
      order by r.updated_at desc, r.id limit page_size offset page_offset
    ) page), '[]'::jsonb)
  );
end; $$;

create function workspace.writer_get_resource(resource_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare target_workspace uuid := workspace_private.require_writing_capability('writer.resource.review');
  resource jsonb;
begin
  select to_jsonb(r) - 'workspace_id' into resource from workspace_private.writing_resources r
  where r.id = resource_id and r.workspace_id = target_workspace;
  -- Missing and another tenant's identifiers have the same response.
  if resource is null then
    raise exception 'Resource unavailable.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('workspaceId', target_workspace, 'retrievedAt', now(), 'resource', resource);
end; $$;

revoke all on function workspace_private.require_bundle_workspace() from public, anon, authenticated;
revoke all on function workspace_private.bundle_capability_active(uuid,text,text) from public, anon, authenticated;
revoke all on function workspace_private.require_writing_capability(text) from public, anon, authenticated;
revoke all on function workspace.get_bundle_experience() from public, anon, authenticated;
revoke all on function workspace.writer_list_resources(text,text,integer,integer) from public, anon, authenticated;
revoke all on function workspace.writer_get_resource(uuid) from public, anon, authenticated;
grant execute on function workspace.get_bundle_experience() to authenticated;
grant execute on function workspace.writer_list_resources(text,text,integer,integer) to authenticated;
grant execute on function workspace.writer_get_resource(uuid) to authenticated;
notify pgrst, 'reload schema';
