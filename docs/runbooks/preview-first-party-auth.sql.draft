-- REVIEW DRAFT ONLY. Not an applied migration; no client is enabled by this file.
-- Target: Entry-dev vnjdubrnmxvmsccxmhst only. Never apply to Production.
-- Register a dedicated PUBLIC OAuth client with PKCE in a separately approved step.
-- Then separately pin its actual UUID in existing product_settings under
-- workspace_preview_browser_client_id. No invented client ID is inserted here.
-- Existing custom-provider/direct-session and MCP grant rules remain separate.
BEGIN;

ALTER TABLE workspace.user_profiles DROP CONSTRAINT workspace_user_profiles_entry_provider_check;
ALTER TABLE workspace.user_profiles ADD CONSTRAINT workspace_user_profiles_entry_provider_check
  CHECK (entry_provider IS NULL OR entry_provider ~ '^custom:[a-z0-9][a-z0-9:-]{1,49}$'
    OR entry_provider = 'first-party:workspace-preview');

CREATE OR REPLACE FUNCTION workspace_private.is_direct_session()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(auth.uid() IS NOT NULL
    AND coalesce(auth.jwt() ->> 'workspace_mcp', 'false') <> 'true'
    AND (
      nullif(auth.jwt() ->> 'client_id', '') IS NULL
      OR (
        auth.jwt() ->> 'iss' = 'https://vnjdubrnmxvmsccxmhst.supabase.co/auth/v1'
        AND auth.jwt() ->> 'aud' = 'authenticated'
        AND auth.jwt() ->> 'role' = 'authenticated'
        AND auth.jwt() ->> 'client_id' = (
          SELECT nullif(setting_value, '') FROM workspace_private.product_settings
          WHERE setting_key = 'workspace_preview_browser_client_id'
        )
        AND EXISTS (
          SELECT 1 FROM auth.sessions AS session_record
          WHERE session_record.id::text = auth.jwt() ->> 'session_id'
            AND session_record.user_id = auth.uid()
            AND session_record.oauth_client_id::text = auth.jwt() ->> 'client_id'
        )
        AND NOT EXISTS (
          SELECT 1 FROM workspace_private.mcp_oauth_resource_grants AS grant_record
          WHERE grant_record.user_id = auth.uid()
            AND grant_record.client_id::text = auth.jwt() ->> 'client_id'
            AND grant_record.status = 'active'
        )
        AND (
          (
            NOT EXISTS (
              SELECT 1 FROM workspace.user_profiles AS profile
              WHERE profile.user_id = auth.uid()
                AND (profile.canonical_user_id IS NOT NULL OR profile.entry_provider IS NOT NULL)
            )
            AND NOT EXISTS (
              SELECT 1 FROM workspace.workspaces AS owned_workspace
              WHERE owned_workspace.owner_user_id = auth.uid()
            )
            AND NOT EXISTS (
              SELECT 1 FROM workspace.workspace_memberships AS membership
              WHERE membership.user_id = auth.uid()
            )
          )
          OR (
            (SELECT count(*) FROM workspace.workspaces AS personal_workspace
             WHERE personal_workspace.workspace_type = 'personal'
               AND personal_workspace.owner_user_id = auth.uid()) = 1
            AND EXISTS (
              SELECT 1 FROM workspace.user_profiles AS profile
              WHERE profile.user_id = auth.uid()
                AND profile.canonical_user_id = auth.uid()
                AND profile.entry_provider = 'first-party:workspace-preview'
            )
            AND (SELECT count(*) FROM workspace.workspace_memberships AS membership
                 JOIN workspace.workspaces AS personal_workspace
                   ON personal_workspace.id = membership.workspace_id
                 WHERE personal_workspace.workspace_type = 'personal'
                   AND personal_workspace.owner_user_id = auth.uid()
                   AND membership.user_id = auth.uid()
                   AND membership.role = 'owner'
                   AND membership.status = 'active') = 1
          )
        )
      )
    ), false);
$$;

CREATE OR REPLACE FUNCTION workspace.ensure_personal_workspace()
 RETURNS SETOF workspace.workspaces
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- A same-project browser client uses the issuer's existing user UUID.
  -- This branch is admitted only by the exact-client/session predicate below.
  if nullif(auth.jwt() ->> 'client_id', '') is not null then
    canonical_subject := caller_id::text;
    provider_identifier := 'first-party:workspace-preview';
  else
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
$function$;


-- CREATE OR REPLACE preserves existing function ownership/ACL. Re-read both on
-- the target before approval; abort if the baseline changed. No new grants.
COMMIT;
