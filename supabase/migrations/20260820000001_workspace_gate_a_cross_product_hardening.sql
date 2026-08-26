-- DOMAIN OWNER: LEAD EMERGENCE MINISTRY
-- PURPOSE: Gate A cross-product hardening for Workspace-only authenticated users.
--
-- Guest page permissions remain intentionally readable by anonymous visitors.
-- Authenticated reads are limited to principals with an actual ministry profile,
-- so a Workspace-only user sharing auth.users cannot enumerate ministry routes.

-- This repository must also reset against a fresh standalone local stack, where
-- Ministry-owned objects intentionally do not exist. Apply the coexistence
-- hardening only when the shared hosted schema provides both dependencies.
do $$
begin
  if to_regclass('public.guest_public_page_permissions') is not null
    and to_regprocedure('public.current_ministry_id()') is not null then
    execute 'drop policy if exists guest_public_page_permissions_select_authenticated on public.guest_public_page_permissions';
    execute $policy$
      create policy guest_public_page_permissions_select_authenticated
        on public.guest_public_page_permissions
        for select to authenticated
        using (public.current_ministry_id() is not null)
    $policy$;
  end if;
end;
$$;

notify pgrst, 'reload schema';
