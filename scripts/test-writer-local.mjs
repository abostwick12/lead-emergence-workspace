import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { appUrl, localConfiguration, localSql, fixtureSession } from "./bundle-local-runtime.mjs";

const config = await localConfiguration();
await writeFile(".bundle-local/public-config.json", JSON.stringify({ url: config.API_URL, anonKey: config.ANON_KEY }));
// The canonical URI is a token audience only. Every network request below uses
// loopback; the local grant schema intentionally requires this exact audience.
localSql("update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp' where setting_key='mcp_resource_uri';");
const fixtures = JSON.parse(await readFile(".bundle-local/fixtures.json", "utf8"));
const writer = await fixtureSession(config, fixtures.writer), reader = await fixtureSession(config, fixtures.reader);
const operator = await fixtureSession(config, fixtures.operator);
const clients = [];
const evidence = [];
function pass(name) { evidence.push(name); console.log("PASS " + name); }
async function web(path, token) {
  const response = await fetch(appUrl + path, { headers: token ? { Authorization: "Bearer " + token } : {} });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
async function oauth(fixture) {
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
    body: JSON.stringify({ client_name: "Synthetic P2 acceptance", redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" })
  });
  const registered = await registration.json();
  assert.ok(registration.ok, "Local DCR must succeed: " + JSON.stringify(registered));
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
async function connect(token) {
  const client = new Client({ name: "writer-local-acceptance", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(appUrl + "/api/mcp"), {
    requestInit: { headers: { Authorization: "Bearer " + token } }
  }));
  clients.push(client);
  return client;
}
let revoked = false;
try {
  const sql = await readFile("supabase/tests/database/writer_bundle_experience.sql", "utf8");
  const result = localSql(sql);
  assert.ok(!/(^|\n)not ok /m.test(result), "All PostgreSQL assertions must pass:\n" + result);
  const sqlTests = (result.match(/(^|\n)ok \d+/g) || []).length;
  assert.ok(sqlTests >= 30);
  pass(sqlTests + " PostgreSQL hostile-access assertions");
  const a = await web("/api/bundles/experience", writer.token);
  const b = await web("/api/bundles/experience", reader.token);
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.ok(a.body.ui.primaryNavigation.some((item) => item.label === "Writing"));
  assert.ok(a.body.ui.dashboardWidgets.some((item) => item.id === "writer.widget.publication_queue"));
  assert.equal(b.body.ui.primaryNavigation.length, 0);
  assert.equal(b.body.ui.dashboardWidgets.length, 0);
  assert.match(a.headers.get("cache-control"), /no-store/);
  pass("actual web API entitlement and widget A/B parity");
  const own = await web("/api/writing/resources/" + fixtures.writerResourceId, writer.token);
  assert.equal(own.status, 200); assert.equal(own.body.resource.title, "The practice of paying attention");
  assert.equal(own.body.review.findings[0].field, "Audience");
  assert.equal((await web("/api/writing/resources/" + fixtures.foreignResourceId, writer.token)).status, 404);
  assert.equal((await web("/api/writing/resources", reader.token)).status, 403);
  assert.equal((await web("/api/writing/resources")).status, 401);
  assert.equal((await web("/api/writing/resources?workspaceId=" + fixtures.other.workspaceId, writer.token)).status, 400);
  pass("actual resource review, unknown/foreign ID, unauthenticated and tenant-override denial");
  const writerOAuth = await oauth(fixtures.writer), readerOAuth = await oauth(fixtures.reader);
  pass("real loopback OAuth registration, consent, grant activation, and PKCE token exchange for two users");
  const mcpA = await connect(writerOAuth.token), mcpB = await connect(readerOAuth.token);
  const toolsA = await mcpA.listTools(), toolsB = await mcpB.listTools();
  assert.ok(toolsA.tools.some((tool) => tool.name === "writer_review_resource"));
  assert.equal(toolsB.tools.some((tool) => tool.name.startsWith("writer_")), false);
  assert.ok((await mcpA.listPrompts()).prompts.some((prompt) => prompt.name === "writer_resource_review"));
  const review = await mcpA.callTool({ name: "writer_review_resource", arguments: { resource_id: fixtures.writerResourceId } });
  assert.ok(!review.isError);
  assert.deepEqual(review.structuredContent.resource, own.body.resource);
  const denied = await mcpA.callTool({ name: "writer_review_resource", arguments: { resource_id: fixtures.foreignResourceId } });
  assert.equal(denied.isError, true);
  pass("actual HTTP MCP tools/prompts and browser source parity, with cross-tenant denial");
  const revoke = await operator.client.rpc("revoke_bundle_entitlement", { target_entitlement_id: fixtures.writer.entitlementId, revocation_reason: "Synthetic P2 lifecycle verification" });
  assert.equal(revoke.error, null); revoked = true;
  const after = await web("/api/bundles/experience", writer.token);
  assert.equal(after.body.ui.primaryNavigation.length, 0); assert.notEqual(after.body.revision, a.body.revision);
  assert.equal((await web("/api/writing/resources", writer.token)).status, 403);
  assert.equal((await mcpA.listTools()).tools.some((tool) => tool.name.startsWith("writer_")), false);
  const cachedCall = await mcpA.callTool({ name: "writer_review_resource", arguments: { resource_id: fixtures.writerResourceId } });
  assert.equal(cachedCall.isError, true);
  pass("revocation removes browser and MCP access without restarting or deploying");
  const disconnect = await writer.client.rpc("disconnect_personal_mcp", { target_client_id: writerOAuth.clientId });
  assert.equal(disconnect.error, null);
  const blocked = await fetch(appUrl + "/api/mcp", { method: "POST",
    headers: { Authorization: "Bearer " + writerOAuth.token, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 101, method: "tools/list", params: {} }) });
  assert.equal(blocked.status, 401);
  pass("revoked OAuth connection is rejected by the real HTTP endpoint");
} finally {
  if (revoked) {
    const restore = await operator.client.rpc("issue_bundle_assignment", { target_workspace_id: fixtures.writer.workspaceId,
      target_bundle_key: "writer_editor", idempotency_key: "p2-restore-" + randomUUID(), target_expires_at: null });
    if (restore.error) throw new Error("Restore the synthetic fixture before browser acceptance.");
    fixtures.writer.entitlementId = restore.data.entitlement_id;
    await writeFile(".bundle-local/fixtures.json", JSON.stringify(fixtures, null, 2));
  }
  await Promise.allSettled(clients.map((client) => client.close()));
}
await writeFile(".bundle-local/api-evidence.json", JSON.stringify({ testedAt: new Date().toISOString(), environment: "loopback Supabase + Next.js", evidence }, null, 2));
