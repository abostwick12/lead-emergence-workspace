-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE
-- PURPOSE: Make trusted Entry OIDC identity validation the sole Personal
-- admission path. This migration intentionally performs no graph repair.

revoke insert, update on table workspace.user_profiles from authenticated;
grant update (clock_timezones) on table workspace.user_profiles to authenticated;
revoke insert, update on table workspace.workspaces from authenticated;
revoke insert on table workspace.workspace_memberships from authenticated;

drop policy if exists user_profiles_insert_self on workspace.user_profiles;
drop policy if exists user_profiles_update_self on workspace.user_profiles;
create policy user_profiles_update_clock_timezones_self on workspace.user_profiles
  for update to authenticated
  using (workspace_private.is_direct_session() and user_id = auth.uid())
  with check (workspace_private.is_direct_session() and user_id = auth.uid());

drop policy if exists workspaces_insert_personal_owner on workspace.workspaces;
drop policy if exists workspaces_update_personal_owner on workspace.workspaces;
drop policy if exists workspace_memberships_insert_personal_owner on workspace.workspace_memberships;

create or replace function workspace.ensure_personal_workspace()
returns setof workspace.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  existing_workspace workspace.workspaces%rowtype;
  workspace_count integer;
  owner_membership_count integer;
  profile_count integer;
  trusted_identity_count integer;
  provider_identifier text;
  provider_subject text;
  canonical_subject text;
  profile_canonical_subject uuid;
  profile_provider text;
  profile_name text;
begin
  if caller_id is null or not workspace_private.is_direct_session() then
    raise exception 'A direct authenticated Workspace session is required.' using errcode = '42501';
  end if;

  -- Serialize first provisioning/retry attempts for one principal without
  -- changing any pre-existing graph.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_id::text, 0));

  select count(*), min(identity.provider), min(identity.provider_id), min(identity.identity_data ->> 'sub')
    into trusted_identity_count, provider_identifier, provider_subject, canonical_subject
  from auth.identities as identity
  join workspace_private.trusted_identity_providers as trusted
    on trusted.provider_identifier = identity.provider
   and trusted.enabled
  where identity.user_id = caller_id
    and identity.identity_data ->> 'sub' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and identity.provider_id = identity.identity_data ->> 'sub';

  if trusted_identity_count <> 1 then
    raise exception 'A verified Lead Emergence identity is required.' using errcode = '42501';
  end if;

  -- The regular expression above makes this cast safe. Keep the provider_id
  -- value available explicitly so an identity cannot be admitted by sub alone.
  if provider_subject <> canonical_subject then
    raise exception 'A verified Lead Emergence identity is required.' using errcode = '42501';
  end if;

  select count(*) into workspace_count
  from workspace.workspaces
  where workspace_type = 'personal' and owner_user_id = caller_id;

  select count(*) into profile_count
  from workspace.user_profiles
  where user_id = caller_id;

  if profile_count = 1 then
    select canonical_user_id, entry_provider
      into profile_canonical_subject, profile_provider
    from workspace.user_profiles
    where user_id = caller_id;
  end if;

  if workspace_count = 0 then
    if profile_count <> 0
      and (profile_canonical_subject is not null or profile_provider is not null) then
      raise exception 'Personal Workspace identity linkage requires review.' using errcode = '42501';
    end if;

    select coalesce(
      nullif(raw_user_meta_data ->> 'full_name', ''),
      nullif(raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(email, 'Personal'), '@', 1),
      'Personal'
    ) into profile_name
    from auth.users
    where id = caller_id;

    insert into workspace.user_profiles (user_id, display_name, canonical_user_id, entry_provider)
    values (caller_id, left(profile_name, 160), canonical_subject::uuid, provider_identifier)
    on conflict (user_id) do update set
      display_name = coalesce(workspace.user_profiles.display_name, excluded.display_name),
      canonical_user_id = excluded.canonical_user_id,
      entry_provider = excluded.entry_provider,
      updated_at = now()
    where workspace.user_profiles.canonical_user_id is null
      and workspace.user_profiles.entry_provider is null;

    if not found then
      raise exception 'Personal Workspace identity linkage requires review.' using errcode = '42501';
    end if;

    insert into workspace.workspaces (workspace_type, name, owner_user_id)
    values ('personal', left(profile_name || '''s Workspace', 160), caller_id)
    returning * into existing_workspace;

    insert into workspace.workspace_memberships (workspace_id, user_id, role, status)
    values (existing_workspace.id, caller_id, 'owner', 'active');
  elsif workspace_count = 1 then
    select * into existing_workspace
    from workspace.workspaces
    where workspace_type = 'personal' and owner_user_id = caller_id;

    select count(*) into owner_membership_count
    from workspace.workspace_memberships as membership
    where membership.workspace_id = existing_workspace.id
      and membership.user_id = caller_id
      and membership.role = 'owner'
      and membership.status = 'active';

    if profile_count <> 1
      or profile_canonical_subject is distinct from canonical_subject::uuid
      or profile_provider is distinct from provider_identifier
      or owner_membership_count <> 1 then
      raise exception 'Personal Workspace integrity requires review.' using errcode = '42501';
    end if;
  else
    raise exception 'Personal Workspace integrity requires review.' using errcode = '42501';
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

revoke all on function workspace.ensure_personal_workspace() from public, anon;
grant execute on function workspace.ensure_personal_workspace() to authenticated;

notify pgrst, 'reload schema';