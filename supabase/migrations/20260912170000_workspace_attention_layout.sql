-- Register the now-implemented native attention widget in the existing
-- user-confirmed layout system. Existing saved preferences are not rewritten.
insert into workspace_private.layout_contributions(identity,bundle_key,kind,route,capability_ids)
values('workspace_experience:workspace.widget.attention','workspace_experience','widget',null,array['workspace.attention'])
on conflict(identity) do nothing;
