-- DOMAIN OWNER: LEAD EMERGENCE MINISTRY
-- PURPOSE: Gate A cross-product hardening for Workspace-only authenticated users.
--
-- Guest page permissions remain intentionally readable by anonymous visitors.
-- Authenticated reads are limited to principals with an actual ministry profile,
-- so a Workspace-only user sharing auth.users cannot enumerate ministry routes.

drop policy if exists guest_public_page_permissions_select_authenticated
  on public.guest_public_page_permissions;

create policy guest_public_page_permissions_select_authenticated
  on public.guest_public_page_permissions
  for select to authenticated
  using (public.current_ministry_id() is not null);

notify pgrst, 'reload schema';
