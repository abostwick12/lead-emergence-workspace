-- User-owned presentation. No client assignments, domain sharing, or model write.
insert into workspace.bundle_definitions(bundle_key,display_name,description)
values ('workspace_experience','Workspace Experience','Compose and explicitly confirm a personal workspace layout.')
on conflict (bundle_key) do nothing;
insert into workspace.capability_catalog(capability_key,display_name,benefit_description) values
 ('workspace_compose','Workspace composition','Compose only currently authorized bundle contributions.'),
 ('workspace_personalize','Workspace layout','Preview, confirm and recover your own layout.')
on conflict (capability_key) do nothing;
insert into workspace.bundle_capabilities(bundle_key,capability_key) values
 ('workspace_experience','workspace_compose'),('workspace_experience','workspace_personalize')
on conflict (bundle_key,capability_key) do nothing;
insert into workspace_private.bundle_capability_bindings values
 ('workspace_experience','workspace_compose','workspace.compose'),
 ('workspace_experience','workspace_personalize','workspace.personalize')
on conflict (bundle_key,capability_key) do nothing;

-- Registered implemented contributions. Labels are sourced from UI manifests in
-- the host, never from persisted arbitrary user text. Home is not customizable.
create table workspace_private.layout_contributions (
 identity text primary key, bundle_key text not null references workspace.bundle_definitions(bundle_key),
 kind text not null check (kind in ('navigation','widget')), route text,
 capability_ids text[] not null check (cardinality(capability_ids)>0),
 check ((kind='navigation') = (route is not null))
);
insert into workspace_private.layout_contributions values
 ('executive:executive.nav.home','executive','navigation','/workspace/executive',array['executive.coordination','executive.brief','executive.review']),
 ('writer_editor:writer.nav.writing','writer_editor','navigation','/workspace/writing',array['writer.resource.library']),
 ('ministry:ministry.nav.home','ministry','navigation','/workspace/ministry',array['ministry.research']),
 ('nonprofit_founder:nonprofit.nav.home','nonprofit_founder','navigation','/workspace/nonprofit',array['nonprofit.roadmap']),
 ('investor:investor.nav.home','investor','navigation','/workspace/investing',array['investor.company_research','investor.thesis','investor.filings']),
 ('executive:executive.widget.attention_brief','executive','widget',null,array['executive.brief']),
 ('writer_editor:writer.widget.publication_queue','writer_editor','widget',null,array['writer.resource.library']),
 ('ministry:ministry.widget.upcoming_teaching','ministry','widget',null,array['ministry.research']),
 ('nonprofit_founder:nonprofit.widget.followups','nonprofit_founder','widget',null,array['nonprofit.roadmap']),
 ('investor:investor.widget.thesis_changes','investor','widget',null,array['investor.thesis']);
create table workspace_private.layout_preferences (
 workspace_id uuid primary key references workspace.workspaces(id) on delete cascade,
 revision integer not null check(revision>0), preferences jsonb not null, updated_at timestamptz not null default now()
);
create table workspace_private.layout_versions (
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 revision integer not null check(revision>0), preferences jsonb not null,
 request_id uuid not null, base_revision integer not null, authority_revision text not null,
 confirmed_by uuid not null references auth.users(id), saved_at timestamptz not null default now(),
 primary key(workspace_id,revision), unique(workspace_id,request_id)
);
alter table workspace_private.layout_contributions enable row level security;
alter table workspace_private.layout_preferences enable row level security;
alter table workspace_private.layout_versions enable row level security;
revoke all on workspace_private.layout_contributions, workspace_private.layout_preferences, workspace_private.layout_versions from public, anon, authenticated;

create function workspace_private.require_layout_workspace()
returns uuid language plpgsql stable security definer set search_path='' as $$
declare target uuid;
begin
 if not workspace_private.is_direct_session() or auth.jwt()->>'client_id' is not null then
  raise exception 'Use the native Workspace to manage layout.' using errcode='42501';
 end if;
 target:=workspace_private.require_bundle_workspace();
 if not workspace_private.bundle_capability_active(target,'workspace_experience','workspace.personalize') then
  raise exception 'Active Workspace Experience access is required.' using errcode='42501';
 end if;
 return target;
end; $$;
create function workspace_private.default_layout()
returns jsonb language sql immutable set search_path='' as $$
 select '{"schemaVersion":"1.0","hiddenItemIds":[],"pinnedNavigationIds":[],"pinnedWidgetIds":[],"orderOverrides":{},"defaultWorkspaceRoute":"/workspace"}'::jsonb;
$$;
create function workspace_private.layout_item_choice(p jsonb, identity text)
returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('hidden',p->'hiddenItemIds' ? identity,'navigation',p->'pinnedNavigationIds' ? identity,
 'widget',p->'pinnedWidgetIds' ? identity,'order',p->'orderOverrides'->identity);
$$;
create function workspace_private.validate_layout(p jsonb, previous jsonb, target uuid)
returns void language plpgsql stable security definer set search_path='' as $$
declare k text; item text; n numeric; row_item workspace_private.layout_contributions; admitted boolean;
begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>60000
  or not (p ?& array['schemaVersion','hiddenItemIds','pinnedNavigationIds','pinnedWidgetIds','orderOverrides','defaultWorkspaceRoute'])
  or (p-array['schemaVersion','hiddenItemIds','pinnedNavigationIds','pinnedWidgetIds','orderOverrides','defaultWorkspaceRoute'])<>'{}'::jsonb
  or p->>'schemaVersion' is distinct from '1.0'
  or jsonb_typeof(p->'defaultWorkspaceRoute') is distinct from 'string'
  or char_length(p->>'defaultWorkspaceRoute')>200
  or (p->>'defaultWorkspaceRoute') !~ '^/workspace(/[a-z0-9][a-z0-9/_-]*)?$'
  or jsonb_typeof(p->'orderOverrides') is distinct from 'object' then
  raise exception 'Invalid layout.' using errcode='22023';
 end if;
 foreach k in array array['hiddenItemIds','pinnedNavigationIds','pinnedWidgetIds'] loop
  if jsonb_typeof(p->k) is distinct from 'array' then raise exception 'Invalid layout list.' using errcode='22023'; end if;
  if jsonb_array_length(p->k)>(case when k='hiddenItemIds' then 200 else 100 end)
   or exists(select 1 from jsonb_array_elements(p->k) x where jsonb_typeof(x)<>'string'
     or (x#>>'{}') !~ '^[a-z][a-z0-9_]{1,49}:[a-z][a-z0-9._-]{2,99}$')
   or (select count(*)<>count(distinct x) from jsonb_array_elements(p->k) x) then
   raise exception 'Invalid layout list.' using errcode='22023';
  end if;
 end loop;
 if (select count(*) from jsonb_object_keys(p->'orderOverrides'))>200 then raise exception 'Too many layout choices.' using errcode='22023'; end if;
 for k in select jsonb_object_keys(p->'orderOverrides') loop
  if k !~ '^[a-z][a-z0-9_]{1,49}:[a-z][a-z0-9._-]{2,99}$' or jsonb_typeof(p->'orderOverrides'->k)<>'number' then
   raise exception 'Invalid layout order.' using errcode='22023';
  end if;
  n:=(p->'orderOverrides'->>k)::numeric;
  if n<0 or n>10000 or n<>trunc(n) then raise exception 'Invalid layout order.' using errcode='22023'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements_text(p->'hiddenItemIds') x
  where p->'pinnedNavigationIds' ? x or p->'pinnedWidgetIds' ? x) then
  raise exception 'An item cannot be pinned and hidden.' using errcode='22023';
 end if;
 for item in
  select jsonb_array_elements_text(p->'hiddenItemIds')
  union select jsonb_array_elements_text(p->'pinnedNavigationIds')
  union select jsonb_array_elements_text(p->'pinnedWidgetIds')
  union select jsonb_object_keys(p->'orderOverrides')
 loop
  select * into row_item from workspace_private.layout_contributions c where c.identity=item;
  if not found then raise exception 'Layout item unavailable.' using errcode='22023'; end if;
  if (p->'pinnedNavigationIds' ? item and row_item.kind<>'navigation')
   or (p->'pinnedWidgetIds' ? item and row_item.kind<>'widget') then
   raise exception 'Invalid pin destination.' using errcode='22023';
  end if;
  select exists(select 1 from unnest(row_item.capability_ids) cap
   where workspace_private.bundle_capability_active(target,row_item.bundle_key,cap)) into admitted;
  -- Retain or remove dormant settings, but never add/change unavailable ones.
  if not admitted and (
   (p->'hiddenItemIds' ? item and not (previous->'hiddenItemIds' ? item))
   or (p->'pinnedNavigationIds' ? item and not (previous->'pinnedNavigationIds' ? item))
   or (p->'pinnedWidgetIds' ? item and not (previous->'pinnedWidgetIds' ? item))
   or (p->'orderOverrides' ? item and p->'orderOverrides'->item is distinct from previous->'orderOverrides'->item)) then
   raise exception 'Layout access changed. Reload and review.' using errcode='42501';
  end if;
 end loop;
 if p->>'defaultWorkspaceRoute'<>'/workspace'
  and p->>'defaultWorkspaceRoute' is distinct from previous->>'defaultWorkspaceRoute'
  and not exists(select 1 from workspace_private.layout_contributions c, unnest(c.capability_ids) cap
   where c.route=p->>'defaultWorkspaceRoute' and workspace_private.bundle_capability_active(target,c.bundle_key,cap)) then
  raise exception 'Default workspace unavailable.' using errcode='42501';
 end if;
end; $$;

create function workspace.get_workspace_layout()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_layout_workspace(); current_layout workspace_private.layout_preferences;
begin
 select * into current_layout from workspace_private.layout_preferences where workspace_id=target;
 return jsonb_build_object('workspaceId',target,'revision',coalesce(current_layout.revision,0),
  'authorityRevision',workspace.get_bundle_experience()->>'revision',
  'preferences',coalesce(current_layout.preferences,workspace_private.default_layout()),
  'updatedAt',current_layout.updated_at,
  'history',coalesce((select jsonb_agg(to_jsonb(v) order by v.revision desc) from
   (select revision,preferences,saved_at as "savedAt" from workspace_private.layout_versions
    where workspace_id=target order by revision desc limit 20) v),'[]'::jsonb));
end; $$;

create function workspace.save_workspace_layout(preferences jsonb,expected_revision integer,
 expected_authority_revision text,request_id uuid,confirmed boolean)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare target uuid:=workspace_private.require_layout_workspace(); current_layout workspace_private.layout_preferences;
 previous jsonb; prior workspace_private.layout_versions; next_revision integer;
begin
 if confirmed is distinct from true or request_id is null or expected_revision is null or expected_revision<0
  or expected_authority_revision is null or char_length(expected_authority_revision) not between 1 and 200 then
  raise exception 'Review and confirm a valid layout.' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('workspace-layout:'||target::text,0));
 if expected_authority_revision is distinct from workspace.get_bundle_experience()->>'revision' then
  raise exception 'Workspace access changed. Reload and review.' using errcode='40001';
 end if;
 select * into current_layout from workspace_private.layout_preferences where workspace_id=target;
 select * into prior from workspace_private.layout_versions v where v.workspace_id=target and v.request_id=save_workspace_layout.request_id;
 if found then
  if prior.preferences is not distinct from preferences and prior.base_revision=expected_revision
   and prior.authority_revision=expected_authority_revision and prior.revision=current_layout.revision then
   return workspace.get_workspace_layout();
  end if;
  raise exception 'This save was superseded or changed. Reload and review.' using errcode='40001';
 end if;
 if expected_revision<>coalesce(current_layout.revision,0) then
  raise exception 'Layout changed in another tab. Reload and review.' using errcode='40001';
 end if;
 previous:=coalesce(current_layout.preferences,workspace_private.default_layout());
 perform workspace_private.validate_layout(preferences,previous,target);
 next_revision:=expected_revision+1;
 insert into workspace_private.layout_versions(workspace_id,revision,preferences,request_id,base_revision,authority_revision,confirmed_by)
 values(target,next_revision,preferences,request_id,expected_revision,expected_authority_revision,auth.uid());
 insert into workspace_private.layout_preferences(workspace_id,revision,preferences)
 values(target,next_revision,preferences)
 on conflict (workspace_id) do update set revision=excluded.revision,preferences=excluded.preferences,updated_at=now();
 return workspace.get_workspace_layout();
end; $$;
revoke all on function workspace_private.require_layout_workspace() from public,anon,authenticated;
revoke all on function workspace_private.default_layout() from public,anon,authenticated;
revoke all on function workspace_private.layout_item_choice(jsonb,text) from public,anon,authenticated;
revoke all on function workspace_private.validate_layout(jsonb,jsonb,uuid) from public,anon,authenticated;
revoke all on function workspace.get_workspace_layout() from public,anon,authenticated;
revoke all on function workspace.save_workspace_layout(jsonb,integer,text,uuid,boolean) from public,anon,authenticated;
grant execute on function workspace.get_workspace_layout() to authenticated;
grant execute on function workspace.save_workspace_layout(jsonb,integer,text,uuid,boolean) to authenticated;
notify pgrst,'reload schema';
