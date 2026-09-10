-- P19 rich source intake is a direct native action. File bytes are processed
-- ephemerally by the host and are never accepted from an assistant session.
create or replace function workspace.authorize_source_intake(p_purpose text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  target uuid;
  bundle_key text;
begin
  if not workspace_private.is_direct_session() or auth.jwt()->>'client_id' is not null then
    raise exception 'Open Workspace to import a source yourself.' using errcode='42501';
  end if;
  target:=workspace_private.require_bundle_workspace();
  if p_purpose='writer_resource' then
    bundle_key:='writer_editor';
    if not workspace_private.bundle_capability_active(target,bundle_key,'writer.resource.manage')
      or not workspace_private.bundle_capability_active(target,bundle_key,'writer.resource.review') then
      raise exception 'Writer source intake is unavailable.' using errcode='42501';
    end if;
  elsif p_purpose='ministry_archive' then
    bundle_key:='ministry';
    if not workspace_private.bundle_capability_active(target,bundle_key,'ministry.archive') then
      raise exception 'Ministry archive intake is unavailable.' using errcode='42501';
    end if;
  else
    raise exception 'Choose a supported source destination.' using errcode='22023';
  end if;
  return jsonb_build_object('schemaVersion','1.0','workspaceId',target,'bundleKey',bundle_key,'purpose',p_purpose);
end; $$;

revoke all on function workspace.authorize_source_intake(text) from public,anon,authenticated;
grant execute on function workspace.authorize_source_intake(text) to authenticated;
