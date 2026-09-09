import assert from "node:assert/strict";
import {createHash,randomBytes} from "node:crypto";
import {fixtureSession} from "./bundle-local-runtime.mjs";
// Fictional loopback acceptance only; never prints OAuth tokens or keys.
export async function localOAuth(config,fixture) {
  const session = await fixtureSession(config, fixture);
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const redirectUri = "http://127.0.0.1:3126/callback";
  const state = randomBytes(20).toString("hex");
  const discovery = await fetch(config.API_URL + "/auth/v1/.well-known/openid-configuration");
  assert.ok(discovery.ok, "Local OAuth discovery must be available.");
  const metadata = await discovery.json();
  for (const name of ["registration_endpoint", "authorization_endpoint", "token_endpoint"]) {
    assert.equal(new URL(metadata[name]).origin, new URL(config.API_URL).origin, "OAuth test endpoints must stay on the isolated local stack.");
  }
  const registration = await fetch(metadata.registration_endpoint, {
    method: "POST", headers: { apikey: config.ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "Synthetic bundle acceptance", redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" })
  });
  const registered = await registration.json();
  assert.ok(registration.ok, "Local DCR must succeed.");
  const clientId = registered.client_id;
  assert.ok(clientId);
  const params = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri,
    scope: "openid email profile", state, code_challenge: challenge, code_challenge_method: "S256",
    resource: "https://workspace.leademergence.com/api/mcp" });
  const authorization = await fetch(metadata.authorization_endpoint + "?" + params, {
    redirect: "manual", headers: { apikey: config.ANON_KEY, Authorization: "Bearer " + session.token }
  });
  const location = authorization.headers.get("location");
  const responseText = location ? "" : await authorization.text();
  assert.ok(location, "Local authorization must redirect: " + responseText.slice(0, 500));
  const authorizationId = new URL(location).searchParams.get("authorization_id");
  assert.ok(authorizationId, "Local consent request must have an ID.");
  const details = await session.client.auth.oauth.getAuthorizationDetails(authorizationId);
  assert.equal(details.error, null, "Synthetic user must load the consent request.");
  const eligibility = await session.client.rpc("resolve_mcp_oauth_authorization", { p_authorization_id: authorizationId });
  assert.equal(eligibility.error, null);
  assert.equal(eligibility.data[0].request_class, "WORKSPACE_MCP");
  const approved = await session.client.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true });
  assert.equal(approved.error, null);
  const activated = await session.client.rpc("activate_mcp_oauth_grant", { p_authorization_id: authorizationId });
  assert.equal(activated.error, null, "The approved local grant must activate through the product RPC.");
  const redirect = new URL(approved.data.redirect_url);
  assert.equal(redirect.searchParams.get("state"), state);
  const code = redirect.searchParams.get("code");
  assert.ok(code);
  const exchange = await fetch(metadata.token_endpoint, {
    method: "POST", headers: { apikey: config.ANON_KEY, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, redirect_uri: redirectUri, code, code_verifier: verifier })
  });
  const tokens = await exchange.json();
  assert.ok(exchange.ok && tokens.access_token, "Local PKCE exchange must return an access token.");
  const claims = JSON.parse(Buffer.from(tokens.access_token.split(".")[1], "base64url").toString());
  assert.equal(claims.workspace_mcp, true);
  assert.equal(claims.aud, "https://workspace.leademergence.com/api/mcp");
  assert.equal(claims.sub, fixture.id);
  return { token: tokens.access_token, clientId };
}
