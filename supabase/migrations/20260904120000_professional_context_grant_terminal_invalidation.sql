-- B2.3 makes every Professional Context protected-read grant terminal when
-- the membership, ownership, or capability authority that issued it changes.
-- The epoch is intentionally grant-specific: unrelated MCP authority remains
-- governed by workspace.mcp_authorizations.authorization_valid_after.

create table workspace_private.professional_context_grant_authority_epochs (
  workspace_id uuid not null references workspace.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  authority_epoch uuid not null default gen_random_uuid(),
  changed_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table workspace_private.professional_context_grant_authority_epochs enable row level security;
revoke all on table workspace_private.professional_context_grant_authority_epochs
  from public, anon, authenticated;

insert into workspace_private.professional_context_grant_authority_epochs (workspace_id, user_id)
select distinct workspace_record.id, workspace_record.owner_user_id
from workspace.workspaces as workspace_record
join workspace.workspace_memberships as membership
  on membership.workspace_id = workspace_record.id
where workspace_record.workspace_type = 'personal'
  and membership.user_id = workspace_record.owner_user_id
  and membership.role = 'owner'
  and membership.status = 'active'
on conflict (workspace_id, user_id) do nothing;

alter table workspace_private.professional_context_read_grants
  add column authority_epoch uuid;

-- P2 is disabled. Give every pre-migration development grant an unmatched
-- epoch so none can become effective after this migration is applied.
update workspace_private.professional_context_read_grants
set authority_epoch = gen_random_uuid()
where authority_epoch is null;

alter table workspace_private.professional_context_read_grants
  alter column authority_epoch set not null;

create or replace function workspace_private.bump_professional_context_grant_authority(
  target_workspace_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_workspace_id is null or target_user_id is null then
    return;
  end if;

  insert into workspace_private.professional_context_grant_authority_epochs (
    workspace_id, user_id, authority_epoch, changed_at
  ) values (
    target_workspace_id, target_user_id, pg_catalog.gen_random_uuid(), pg_catalog.clock_timestamp()
  )
  on conflict (workspace_id, user_id) do update set
    authority_epoch = excluded.authority_epoch,
    changed_at = excluded.changed_at;
end;
$$;

create or replace function workspace_private.ensure_professional_context_grant_authority(
  target_workspace_id uuid,
  target_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_epoch uuid;
begin
  insert into workspace_private.professional_context_grant_authority_epochs (
    workspace_id, user_id
  ) values (
    target_workspace_id, target_user_id
  )
  on conflict (workspace_id, user_id) do nothing;

  select authority.authority_epoch into current_epoch
  from workspace_private.professional_context_grant_authority_epochs as authority
  where authority.workspace_id = target_workspace_id
    and authority.user_id = target_user_id
  for share;

  return current_epoch;
end;
$$;

create or replace function workspace_private.professional_context_capability_deadline(
  target_workspace_id uuid,
  target_user_id uuid
)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select min(entitlement.expires_at)
  from workspace.bundle_entitlements as entitlement
  join workspace.bundle_definitions as definition
    on definition.bundle_key = entitlement.bundle_key
  join workspace.bundle_capabilities as bundle_capability
    on bundle_capability.bundle_key = entitlement.bundle_key
  where entitlement.workspace_id = target_workspace_id
    and entitlement.beneficiary_user_id = target_user_id
    and entitlement.starts_at <= now()
    and entitlement.revoked_at is null
    and (entitlement.expires_at is null or entitlement.expires_at > now())
    and definition.availability_status = 'active'
    and bundle_capability.capability_key = 'professional_context'
    and bundle_capability.enabled
    and exists (
      select 1
      from workspace.personal_plans as owner_plan
      where owner_plan.workspace_id = target_workspace_id
        and owner_plan.user_id = target_user_id
        and owner_plan.status = 'active'
    );
$$;

create or replace function workspace_private.bump_professional_context_grant_on_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform workspace_private.bump_professional_context_grant_authority(new.workspace_id, new.user_id);
    return new;
  elsif tg_op = 'DELETE' then
    perform workspace_private.bump_professional_context_grant_authority(old.workspace_id, old.user_id);
    return old;
  end if;

  perform workspace_private.bump_professional_context_grant_authority(old.workspace_id, old.user_id);
  if new.workspace_id is distinct from old.workspace_id
    or new.user_id is distinct from old.user_id then
    perform workspace_private.bump_professional_context_grant_authority(new.workspace_id, new.user_id);
  end if;
  return new;
end;
$$;

create or replace function workspace_private.bump_professional_context_grant_on_plan_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform workspace_private.bump_professional_context_grant_authority(new.workspace_id, new.user_id);
    return new;
  elsif tg_op = 'DELETE' then
    perform workspace_private.bump_professional_context_grant_authority(old.workspace_id, old.user_id);
    return old;
  end if;

  perform workspace_private.bump_professional_context_grant_authority(old.workspace_id, old.user_id);
  if new.workspace_id is distinct from old.workspace_id
    or new.user_id is distinct from old.user_id then
    perform workspace_private.bump_professional_context_grant_authority(new.workspace_id, new.user_id);
  end if;
  return new;
end;
$$;

create or replace function workspace_private.bump_professional_context_grant_on_plan_capability_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  authority_record record;
begin
  if tg_op <> 'INSERT' and old.capability_key = 'professional_context' then
    for authority_record in
      select distinct personal_plan.workspace_id, personal_plan.user_id
      from workspace.personal_plans as personal_plan
      where personal_plan.plan_key = old.plan_key
    loop
      perform workspace_private.bump_professional_context_grant_authority(
        authority_record.workspace_id, authority_record.user_id
      );
    end loop;
  end if;

  if tg_op <> 'DELETE' and new.capability_key = 'professional_context' then
    for authority_record in
      select distinct personal_plan.workspace_id, personal_plan.user_id
      from workspace.personal_plans as personal_plan
      where personal_plan.plan_key = new.plan_key
    loop
      perform workspace_private.bump_professional_context_grant_authority(
        authority_record.workspace_id, authority_record.user_id
      );
    end loop;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function workspace_private.bump_professional_context_grant_on_bundle_entitlement_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform workspace_private.bump_professional_context_grant_authority(
      new.workspace_id, new.beneficiary_user_id
    );
    return new;
  elsif tg_op = 'DELETE' then
    perform workspace_private.bump_professional_context_grant_authority(
      old.workspace_id, old.beneficiary_user_id
    );
    return old;
  end if;

  perform workspace_private.bump_professional_context_grant_authority(
    old.workspace_id, old.beneficiary_user_id
  );
  if new.workspace_id is distinct from old.workspace_id
    or new.beneficiary_user_id is distinct from old.beneficiary_user_id then
    perform workspace_private.bump_professional_context_grant_authority(
      new.workspace_id, new.beneficiary_user_id
    );
  end if;
  return new;
end;
$$;

create or replace function workspace_private.bump_professional_context_grant_on_bundle_capability_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  authority_record record;
begin
  if tg_op <> 'INSERT' and old.capability_key = 'professional_context' then
    for authority_record in
      select distinct entitlement.workspace_id, entitlement.beneficiary_user_id as user_id
      from workspace.bundle_entitlements as entitlement
      where entitlement.bundle_key = old.bundle_key
    loop
      perform workspace_private.bump_professional_context_grant_authority(
        authority_record.workspace_id, authority_record.user_id
      );
    end loop;
  end if;

  if tg_op <> 'DELETE' and new.capability_key = 'professional_context' then
    for authority_record in
      select distinct entitlement.workspace_id, entitlement.beneficiary_user_id as user_id
      from workspace.bundle_entitlements as entitlement
      where entitlement.bundle_key = new.bundle_key
    loop
      perform workspace_private.bump_professional_context_grant_authority(
        authority_record.workspace_id, authority_record.user_id
      );
    end loop;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function workspace_private.bump_professional_context_grant_on_bundle_definition_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  authority_record record;
  target_bundle_key text;
begin
  if tg_op = 'UPDATE'
    and new.availability_status is not distinct from old.availability_status then
    return new;
  end if;

  target_bundle_key := case when tg_op = 'DELETE' then old.bundle_key else new.bundle_key end;
  for authority_record in
    select distinct entitlement.workspace_id, entitlement.beneficiary_user_id as user_id
    from workspace.bundle_entitlements as entitlement
    where entitlement.bundle_key = target_bundle_key
      and exists (
        select 1
        from workspace.bundle_capabilities as bundle_capability
        where bundle_capability.bundle_key = entitlement.bundle_key
          and bundle_capability.capability_key = 'professional_context'
      )
  loop
    perform workspace_private.bump_professional_context_grant_authority(
      authority_record.workspace_id, authority_record.user_id
    );
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger bump_professional_context_grant_on_membership_change
after insert or update or delete on workspace.workspace_memberships
for each row execute function workspace_private.bump_professional_context_grant_on_membership_change();

create trigger bump_professional_context_grant_on_plan_change
after insert or update or delete on workspace.personal_plans
for each row execute function workspace_private.bump_professional_context_grant_on_plan_change();

create trigger bump_professional_context_grant_on_plan_capability_change
after insert or update or delete on workspace.plan_capabilities
for each row execute function workspace_private.bump_professional_context_grant_on_plan_capability_change();

create trigger bump_professional_context_grant_on_bundle_entitlement_change
after insert or update or delete on workspace.bundle_entitlements
for each row execute function workspace_private.bump_professional_context_grant_on_bundle_entitlement_change();

create trigger bump_professional_context_grant_on_bundle_capability_change
after insert or update or delete on workspace.bundle_capabilities
for each row execute function workspace_private.bump_professional_context_grant_on_bundle_capability_change();

create trigger bump_professional_context_grant_on_bundle_definition_change
after insert or update or delete on workspace.bundle_definitions
for each row execute function workspace_private.bump_professional_context_grant_on_bundle_definition_change();

create or replace function workspace_private.mcp_context_privacy_allowed(
  target_workspace_id uuid,
  target_privacy_level text,
  requested_privacy_scopes text[] default '{}'::text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target_privacy_level = 'normal' then true
    when target_privacy_level not in ('private', 'sensitive') then false
    when not target_privacy_level = any(coalesce(requested_privacy_scopes, '{}'::text[])) then false
    else exists (
      select 1
      from workspace_private.professional_context_read_grants as grant_record
      join workspace_private.professional_context_grant_authority_epochs as authority
        on authority.workspace_id = grant_record.workspace_id
        and authority.user_id = grant_record.user_id
      join workspace.mcp_authorizations as auth_record
        on auth_record.id = grant_record.mcp_authorization_id
      where grant_record.workspace_id = target_workspace_id
        and grant_record.user_id = auth.uid()
        and grant_record.client_id = nullif(auth.jwt() ->> 'client_id', '')
        and grant_record.privacy_scope = target_privacy_level
        and grant_record.authority_epoch = authority.authority_epoch
        and grant_record.revoked_at is null
        and grant_record.expires_at > now()
        and auth_record.workspace_id = grant_record.workspace_id
        and auth_record.created_by = grant_record.user_id
        and auth_record.client_id = grant_record.client_id
        and auth_record.status = 'connected'
        and auth_record.authorization_valid_after is not distinct from grant_record.authorization_valid_after
    )
  end;
$$;

create or replace function workspace.create_professional_context_read_grant(
  target_client_id text,
  target_privacy_scope text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_direct_context_workspace();
  authorization_record workspace.mcp_authorizations%rowtype;
  grant_record workspace_private.professional_context_read_grants%rowtype;
  current_authority_epoch uuid;
  capability_deadline timestamptz;
  grant_issued_at timestamptz := now();
  grant_expires_at timestamptz;
begin
  if target_privacy_scope not in ('private', 'sensitive') then
    raise exception 'A private or sensitive read scope is required.' using errcode = '22023';
  end if;

  -- Hold the current grant authority through issuance. Any concurrent trust
  -- mutation waits to bump the epoch, then terminally invalidates this grant.
  current_authority_epoch := workspace_private.ensure_professional_context_grant_authority(
    target_workspace_id, auth.uid()
  );

  if not workspace_private.has_personal_capability(target_workspace_id, 'core_workspace')
    or not workspace_private.has_personal_capability(target_workspace_id, 'workspace_mcp')
    or not workspace_private.has_personal_capability(target_workspace_id, 'professional_context') then
    raise exception 'Professional Context protected reads are not available for this Workspace.' using errcode = '42501';
  end if;

  select * into authorization_record
  from workspace.mcp_authorizations as auth_record
  where auth_record.workspace_id = target_workspace_id
    and auth_record.created_by = auth.uid()
    and auth_record.client_id = target_client_id
    and auth_record.status = 'connected';
  if not found then
    raise exception 'This assistant connection is not authorized.' using errcode = '42501';
  end if;

  capability_deadline := workspace_private.professional_context_capability_deadline(
    target_workspace_id, auth.uid()
  );
  grant_expires_at := least(
    grant_issued_at + case
      when target_privacy_scope = 'private' then interval '10 minutes'
      else interval '5 minutes'
    end,
    coalesce(capability_deadline, 'infinity'::timestamptz)
  );

  if grant_expires_at <= grant_issued_at then
    raise exception 'Professional Context protected reads are not available for this Workspace.' using errcode = '42501';
  end if;

  update workspace_private.professional_context_read_grants as prior_grant
  set revoked_at = now(), revoked_by = auth.uid()
  where prior_grant.workspace_id = target_workspace_id
    and prior_grant.user_id = auth.uid()
    and prior_grant.mcp_authorization_id = authorization_record.id
    and prior_grant.client_id = authorization_record.client_id
    and prior_grant.privacy_scope = target_privacy_scope
    and prior_grant.revoked_at is null
    and prior_grant.expires_at > now();

  insert into workspace_private.professional_context_read_grants (
    workspace_id, user_id, mcp_authorization_id, client_id,
    authorization_valid_after, authority_epoch, privacy_scope, issued_at, expires_at
  ) values (
    target_workspace_id, auth.uid(), authorization_record.id, authorization_record.client_id,
    authorization_record.authorization_valid_after, current_authority_epoch,
    target_privacy_scope, grant_issued_at, grant_expires_at
  ) returning * into grant_record;

  return jsonb_build_object(
    'grant_id', grant_record.id,
    'client_id', grant_record.client_id,
    'privacy_scope', grant_record.privacy_scope,
    'issued_at', grant_record.issued_at,
    'expires_at', grant_record.expires_at,
    'status', 'active'
  );
end;
$$;

create or replace function workspace.list_professional_context_read_grants()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid := workspace_private.require_direct_context_workspace();
  protected_reads_available boolean;
  current_authority_epoch uuid;
begin
  protected_reads_available :=
    workspace_private.has_personal_capability(target_workspace_id, 'core_workspace')
    and workspace_private.has_personal_capability(target_workspace_id, 'workspace_mcp')
    and workspace_private.has_personal_capability(target_workspace_id, 'professional_context');

  select authority.authority_epoch into current_authority_epoch
  from workspace_private.professional_context_grant_authority_epochs as authority
  where authority.workspace_id = target_workspace_id
    and authority.user_id = auth.uid();

  return jsonb_build_object('grants', coalesce((
    select jsonb_agg(jsonb_build_object(
      'grant_id', grant_record.id,
      'client_id', grant_record.client_id,
      'privacy_scope', grant_record.privacy_scope,
      'issued_at', grant_record.issued_at,
      'expires_at', grant_record.expires_at,
      'status', case
        when grant_record.revoked_at is not null then 'revoked'
        when grant_record.expires_at <= now() then 'expired'
        when not protected_reads_available
          or grant_record.authority_epoch is distinct from current_authority_epoch
          or auth_record.status <> 'connected'
          or auth_record.authorization_valid_after is distinct from grant_record.authorization_valid_after then 'revoked'
        else 'active'
      end
    ) order by grant_record.issued_at desc)
    from workspace_private.professional_context_read_grants as grant_record
    join workspace.mcp_authorizations as auth_record
      on auth_record.id = grant_record.mcp_authorization_id
    where grant_record.workspace_id = target_workspace_id
      and grant_record.user_id = auth.uid()
      and auth_record.workspace_id = grant_record.workspace_id
      and auth_record.created_by = grant_record.user_id
      and auth_record.client_id = grant_record.client_id
  ), '[]'::jsonb));
end;
$$;

revoke all on function workspace_private.bump_professional_context_grant_authority(uuid, uuid)
  from public, anon, authenticated;
revoke all on function workspace_private.ensure_professional_context_grant_authority(uuid, uuid)
  from public, anon, authenticated;
revoke all on function workspace_private.professional_context_capability_deadline(uuid, uuid)
  from public, anon, authenticated;
revoke all on function workspace_private.bump_professional_context_grant_on_membership_change()
  from public, anon, authenticated;
revoke all on function workspace_private.bump_professional_context_grant_on_plan_change()
  from public, anon, authenticated;
revoke all on function workspace_private.bump_professional_context_grant_on_plan_capability_change()
  from public, anon, authenticated;
revoke all on function workspace_private.bump_professional_context_grant_on_bundle_entitlement_change()
  from public, anon, authenticated;
revoke all on function workspace_private.bump_professional_context_grant_on_bundle_capability_change()
  from public, anon, authenticated;
revoke all on function workspace_private.bump_professional_context_grant_on_bundle_definition_change()
  from public, anon, authenticated;
revoke all on function workspace_private.mcp_context_privacy_allowed(uuid, text, text[])
  from public, anon, authenticated;
revoke all on function workspace.create_professional_context_read_grant(text, text)
  from public, anon, authenticated;
revoke all on function workspace.list_professional_context_read_grants()
  from public, anon, authenticated;
grant execute on function workspace.create_professional_context_read_grant(text, text) to authenticated;
grant execute on function workspace.list_professional_context_read_grants() to authenticated;

comment on table workspace_private.professional_context_grant_authority_epochs is
  'Private terminal-invalidation epochs for Professional Context protected-read grants; never mutation authority.';
comment on column workspace_private.professional_context_read_grants.authority_epoch is
  'Issuance-time grant authority epoch. Any later trust-authority change makes the grant permanently ineffective.';
