-- ChatGPT's public OAuth client does not always emit client_id directly in
-- the access-token claims. Recover it from the authenticated OAuth session so
-- the MCP resource can apply the same exact-client binding used by Claude.
create or replace function workspace_private.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb := event -> 'claims';
  resource_uri text;
  token_client_id text := nullif(claims ->> 'client_id', '');
  token_session_id uuid;
  token_user_id uuid;
begin
  if token_client_id is null then
    begin
      token_session_id := (claims ->> 'session_id')::uuid;
      token_user_id := (claims ->> 'sub')::uuid;
    exception when invalid_text_representation then
      token_session_id := null;
      token_user_id := null;
    end;

    if token_session_id is not null and token_user_id is not null then
      select oauth_client_id::text into token_client_id
      from auth.sessions
      where id = token_session_id
        and user_id = token_user_id
        and oauth_client_id is not null;
    end if;
  end if;

  if token_client_id is not null then
    select setting_value into resource_uri
    from workspace_private.product_settings
    where setting_key = 'mcp_resource_uri';

    claims := pg_catalog.jsonb_set(claims, '{client_id}', pg_catalog.to_jsonb(token_client_id), true);
    claims := pg_catalog.jsonb_set(claims, '{aud}', pg_catalog.to_jsonb(resource_uri), true);
    claims := pg_catalog.jsonb_set(claims, '{workspace_mcp}', 'true'::jsonb, true);
    event := pg_catalog.jsonb_set(event, '{claims}', claims, true);
  end if;

  return event;
end;
$$;
