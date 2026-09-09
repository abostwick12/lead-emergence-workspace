-- Client-confirmed writing preferences and revision-bound publication preparation.
-- Catalog configuration only: no assignment, provider call, or hosted action.
insert into workspace.capability_catalog(capability_key,display_name,benefit_description) values
 ('writer_profile','Writing preferences','Own and confirm the voice and taxonomy used in Writing reviews.') on conflict do nothing;
insert into workspace.bundle_capabilities(bundle_key,capability_key) values ('writer_editor','writer_profile') on conflict do nothing;
insert into workspace_private.bundle_capability_bindings values ('writer_editor','writer_profile','writer.profile') on conflict do nothing;
create table workspace_private.writing_profiles (
 workspace_id uuid primary key references workspace.workspaces(id) on delete cascade,
 revision integer not null check(revision>0), profile jsonb,
 request_id uuid not null, confirmed_by uuid not null references auth.users(id),
 confirmed_at timestamptz not null default now()
);
create table workspace_private.writing_profile_revisions (
 workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
 revision integer not null, profile jsonb, request_id uuid not null,
 confirmed_by uuid not null references auth.users(id), confirmed_at timestamptz not null,
 primary key(workspace_id,revision), unique(workspace_id,request_id)
);
alter table workspace_private.writing_profiles enable row level security;
alter table workspace_private.writing_profile_revisions enable row level security;
revoke all on workspace_private.writing_profiles,workspace_private.writing_profile_revisions from public,anon,authenticated;

create function workspace_private.writing_profile_result(p workspace_private.writing_profiles) returns jsonb
language sql immutable security definer set search_path='' as $$
 select jsonb_build_object('revision',coalesce(p.revision,0),'profile',p.profile,
 'epistemicState',case when p.profile is null then 'unset' else 'confirmed' end,
 'confirmedAt',p.confirmed_at);
$$;
create function workspace.writer_get_profile() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_writing_capability('writer.profile'); p workspace_private.writing_profiles;
begin
 select * into p from workspace_private.writing_profiles x where x.workspace_id=target;
 return workspace_private.writing_profile_result(p);
end; $$;

create function workspace.writer_save_profile(expected_revision integer,request_id uuid,profile_input jsonb,confirm_preferences boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=workspace_private.require_writing_capability('writer.profile');
 p workspace_private.writing_profiles; previous workspace_private.writing_profile_revisions; item record; lim integer; value jsonb;
begin
 if not workspace_private.is_direct_session() or auth.jwt()->>'client_id' is not null then
  raise exception 'Confirm writing preferences yourself in Workspace.' using errcode='42501';
 end if;
 if confirm_preferences is distinct from true or expected_revision is null or expected_revision<0 or request_id is null then
  raise exception 'Confirm the exact preferences and current revision.' using errcode='22023';
 end if;
 if profile_input is not null then
  if jsonb_typeof(profile_input)<>'object' or octet_length(profile_input::text)>160000 then raise exception 'Invalid writing profile.' using errcode='22023'; end if;
  for item in select * from jsonb_each(profile_input) loop
   if item.key in ('preferred_terms','avoid_terms','topics','themes') then
    lim:=case when item.key='themes' then 240 else 120 end;
    if jsonb_typeof(item.value)<>'array' then raise exception 'Use a bounded list of labels.' using errcode='22023'; end if;
    if jsonb_array_length(item.value)>100 then raise exception 'Use up to 100 labels per list.' using errcode='22023'; end if;
    for value in select * from jsonb_array_elements(item.value) loop
     if jsonb_typeof(value)<>'string' or char_length(trim(value#>>'{}')) not between 1 and lim then raise exception 'Invalid profile label.' using errcode='22023'; end if;
    end loop;
    if (select count(distinct lower(trim(v))) from jsonb_array_elements_text(item.value) v)<>jsonb_array_length(item.value) then raise exception 'Use each label once.' using errcode='22023'; end if;
   else
    lim:=case item.key when 'voice_notes' then 4000 when 'audience_notes' then 1000 when 'editing_boundaries' then 2000 when 'website_notes' then 2000 else null end;
    if lim is null or jsonb_typeof(item.value)<>'string' or char_length(item.value#>>'{}')>lim then raise exception 'Invalid profile field.' using errcode='22023'; end if;
   end if;
  end loop;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 select * into p from workspace_private.writing_profiles x where x.workspace_id=target for update;
 select * into previous from workspace_private.writing_profile_revisions x where x.workspace_id=target and x.request_id=writer_save_profile.request_id;
 if found then
  if previous.profile is distinct from profile_input then raise exception 'Profile request already used.' using errcode='40001'; end if;
  -- Do not make a delayed retry appear to restore a version superseded later.
  if previous.revision<>p.revision then raise exception 'This profile has changed. Reload before making another decision.' using errcode='40001'; end if;
  return workspace_private.writing_profile_result(p);
 end if;
 if coalesce(p.revision,0)<>expected_revision then raise exception 'Writing preferences changed. Your version was not applied.' using errcode='40001'; end if;
 insert into workspace_private.writing_profiles(workspace_id,revision,profile,request_id,confirmed_by)
 values(target,expected_revision+1,profile_input,writer_save_profile.request_id,auth.uid())
 on conflict(workspace_id) do update set revision=excluded.revision,profile=excluded.profile,request_id=excluded.request_id,confirmed_by=excluded.confirmed_by,confirmed_at=now()
 returning * into p;
 insert into workspace_private.writing_profile_revisions values(p.workspace_id,p.revision,p.profile,p.request_id,p.confirmed_by,p.confirmed_at);
 return workspace_private.writing_profile_result(p);
end; $$;

create function workspace.writer_get_profile_history() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_writing_capability('writer.profile');
begin
 if not workspace_private.is_direct_session() or auth.jwt()->>'client_id' is not null then raise exception 'Profile history is private to Workspace.' using errcode='42501'; end if;
 return jsonb_build_object('revisions',coalesce((select jsonb_agg(to_jsonb(p) order by p.revision desc) from
 (select revision,profile,confirmed_at as "confirmedAt" from workspace_private.writing_profile_revisions x where x.workspace_id=target order by revision desc limit 10) p),'[]'));
end; $$;

create function workspace.writer_publication_context(resource_id uuid,expected_revision integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=workspace_private.require_writing_capability('writer.resource.review'); r workspace_private.writing_resources;
begin
 if expected_revision is null or expected_revision<1 then raise exception 'Choose a saved resource revision.' using errcode='22023'; end if;
 select * into r from workspace_private.writing_resources x where x.workspace_id=target and x.id=resource_id;
 if not found then raise exception 'Resource unavailable.' using errcode='P0002'; end if;
 if r.revision<>expected_revision then raise exception 'The resource changed. Prepare a new packet from the latest revision.' using errcode='40001'; end if;
 return jsonb_build_object('resource',to_jsonb(r)-'workspace_id','preparedAt',now(),
 'pendingProposals',(select count(*) from workspace_private.writing_proposals p where p.workspace_id=target and p.resource_id=r.id and p.status='pending'));
end; $$;

revoke all on function workspace_private.writing_profile_result(workspace_private.writing_profiles) from public,anon,authenticated;
revoke all on function workspace.writer_get_profile(),workspace.writer_save_profile(integer,uuid,jsonb,boolean),workspace.writer_get_profile_history(),
 workspace.writer_publication_context(uuid,integer) from public,anon,authenticated;
grant execute on function workspace.writer_get_profile(),workspace.writer_save_profile(integer,uuid,jsonb,boolean),workspace.writer_get_profile_history(),
 workspace.writer_publication_context(uuid,integer) to authenticated;
notify pgrst,'reload schema';
