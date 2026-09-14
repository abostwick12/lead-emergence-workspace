import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url)).replaceAll("\\", "/").replace(/\/$/, "");
mkdirSync(join(root, ".sotf-local"), { recursive: true });
const evidencePath = process.env.SOTF_REFERENCE_EVIDENCE_PATH ?? join(root, ".sotf-local", "reference-parsing-evidence.json");
const docker = process.env.SOTF_DOCKER ?? (process.platform === "win32"
  ? join(homedir(), "AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe") : "docker");
const supabase = process.platform === "win32" ? join(homedir(), "scoop/shims/supabase.exe") : "supabase";
const sql = (query) => execFileSync(docker, [
  "exec", "-i", "supabase_db_lead-emergence-workspace-local", "psql", "-X", "-v", "ON_ERROR_STOP=1",
  "-U", "postgres", "-d", "postgres", "-Atq",
], { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const load = (path) => import(pathToFileURL(root + "/node_modules/" + path).href);
const { createClient } = await load("@supabase/supabase-js/dist/index.mjs");
const { createServer } = await load("vite/dist/node/index.js");
const { McpServer } = await load("@modelcontextprotocol/sdk/dist/esm/server/mcp.js");
const { Client } = await load("@modelcontextprotocol/sdk/dist/esm/client/index.js");
const { InMemoryTransport } = await load("@modelcontextprotocol/sdk/dist/esm/inMemory.js");

const status = JSON.parse(execFileSync(supabase, ["status", "--output", "json"], {
  cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
}));
assert.equal(status.API_URL, "http://127.0.0.1:56421");
assert.equal(status.linked_project ?? null, null);

const user = "81111111-1111-4111-8111-111111111111";
const workspace = "81aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const clientId = "81cccccc-cccc-4ccc-8ccc-cccccccccccc";
const resource = "https://workspace.leademergence.com/api/mcp";
const surfaces = [
  "workspace_private.sotf_daily_brief_outcomes", "workspace_private.sotf_operation_events",
  "workspace_private.sotf_operation_heads", "workspace_private.sotf_workflow_access_audit",
];
const corpus = JSON.parse(readFileSync(join(root, "supabase/tests/database/sotf_v1_reference_parsing_parity.sql"), "utf8").split("$parsing$")[1]);
assert(corpus.length >= 15);

function bearer() {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = encode({ alg: "HS256", typ: "JWT" }) + "." + encode({
    sub: user, role: "authenticated", aud: resource, client_id: clientId, workspace_mcp: "true",
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return unsigned + "." + createHmac("sha256", status.JWT_SECRET).update(unsigned).digest("base64url");
}

const db = createClient(status.API_URL, status.ANON_KEY, {
  db: { schema: "workspace" },
  global: { fetch: (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    assert.equal(new URL(url).origin, status.API_URL, "reference runner must remain on loopback");
    const headers = new Headers(init?.headers);
    headers.set("Authorization", "Bearer " + bearer());
    return fetch(input, { ...init, headers });
  } },
  auth: { persistSession: false, autoRefreshToken: false },
});

const snapshot = () => JSON.parse(sql("select jsonb_build_object(" + surfaces.map((table) =>
  quote(table) + ",(select jsonb_build_object('count',count(*),'digest',md5(coalesce(string_agg(row_to_json(r)::text,'|' order by row_to_json(r)::text),''))) from " + table + " r)"
).join(",") + ")"));
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const report = {
  head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  started: new Date().toISOString(),
  canonicalRule: "exact decoded string; no trim, case folding, Unicode normalization, or lookalike mapping",
  cases: [], handler: { accept: 0, deny: 0 }, rpc: { accept: 0, deny: 0 }, failure: null,
};
const connections = [];
let loader;
let host;
let store;
let revision = 0;
let authorityToken = "sha256:" + "0".repeat(64);
let initialized = false;
const content = (result) => result.structuredContent;

async function call(name, args = {}) {
  try { return await host.callTool({ name, arguments: args }); }
  catch (error) { return { isError: true, transportError: error.message }; }
}

async function append(command) {
  const result = await store.execute({
    requestId: randomUUID(), expectedRevision: revision, userConfirmed: true,
    dataClass: "ordinary_transition_operations", command,
  });
  revision = result.state.revision;
}

const hypothesis = (id) => ({
  type: "save_hypothesis",
  hypothesis: {
    id, proposition: "Synthetic " + id, whyPromising: "It is testable", assumptions: [], gaps: [],
    nextExperiment: "Run a synthetic test", reviewTrigger: "After the test", status: "continue",
    confidenceExplanation: "Still provisional",
  },
});

const outcome = (raw, index) => ({
  schema_version: "1",
  request_id: "81300000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
  run_id: "81400000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
  workflow_id: "transition.daily_brief", workflow_version: "1.0.0", expected_state_revision: revision,
  expected_authority_token: authorityToken,
  brief_date: date, time_zone: "America/Chicago", host: "chatgpt", execution_mode: "A",
  data_class: "ordinary_transition_operations", user_confirmed: true, status: "degraded",
  connector_results: { calendar_read: "not_requested", email_read: "not_requested" },
  degradation_reasons: ["state_truncated"],
  selected_le_refs: [{ entity_type: "hypothesis", entity_id: raw }],
  priority_count: 1, usefulness: "not_rated",
  provenance: { source: "host_reported_user_confirmed", provider_content_persisted: false },
});

async function assertDualDeny(label, payload) {
  const before = snapshot();
  const handlerResult = await call("sotf_record_daily_brief_outcome", payload);
  assert.notEqual(content(handlerResult)?.status, "ok", label + " handler must deny");
  assert.deepEqual(snapshot(), before, label + " handler denial must not mutate");
  const { expected_authority_token, ...storedOutcome } = payload;
  const rpcResult = await db.rpc("sotf_v1_record_daily_brief_outcome", { outcome: storedOutcome, p_expected_authority_token: expected_authority_token });
  assert(rpcResult.error, label + " authenticated RPC must deny");
  assert.equal(rpcResult.error.code, "22023", label + " RPC must fail as invalid input");
  assert.deepEqual(snapshot(), before, label + " RPC denial must not mutate");
  report.handler.deny += 1;
  report.rpc.deny += 1;
  return { handler: "DENY", rpc: "DENY", persistence: "UNCHANGED" };
}

async function assertDualAccept(label, payload) {
  const before = snapshot();
  const handlerResult = await call("sotf_record_daily_brief_outcome", payload);
  assert.equal(content(handlerResult)?.status, "ok", label + " handler must accept");
  const afterHandler = snapshot();
  assert.equal(afterHandler[surfaces[0]].count, before[surfaces[0]].count + 1, label + " persists once");
  for (const table of surfaces.slice(1)) assert.deepEqual(afterHandler[table], before[table], label + " does not alter " + table);
  const { expected_authority_token, ...storedOutcome } = payload;
  const rpcResult = await db.rpc("sotf_v1_record_daily_brief_outcome", { outcome: storedOutcome, p_expected_authority_token: expected_authority_token });
  assert.ifError(rpcResult.error);
  assert.equal(rpcResult.data?.replayed, true, label + " exact RPC retry must replay");
  assert.deepEqual(snapshot(), afterHandler, label + " replay must not duplicate");
  report.handler.accept += 1;
  report.rpc.accept += 1;
  return { handler: "ACCEPT", rpc: "ACCEPT", persistence: "ONE_OUTCOME_EXACT_REPLAY" };
}

const savedSettings = JSON.parse(sql("select jsonb_object_agg(setting_key,setting_value) from workspace_private.product_settings where setting_key in ('sotf_v1_daily_brief_enabled','mcp_dynamic_admission_enabled','mcp_resource_uri')"));
try {
  assert.equal(sql("select count(*) from auth.users"), "0", "local stack must begin without users");
  sql(
    "insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values " +
    "('00000000-0000-0000-0000-000000000000','" + user + "','authenticated','authenticated','sotf.reference.local@example.invalid','',now(),'{\"provider\":\"email\",\"providers\":[\"email\"]}','{}',now(),now());" +
    "insert into workspace.user_profiles(user_id,display_name) values ('" + user + "','Synthetic reference parity');" +
    "insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values ('" + workspace + "','personal','Synthetic reference parity','" + user + "');" +
    "insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values ('" + workspace + "','" + user + "','owner','active');" +
    "insert into workspace.personal_plans(workspace_id,user_id,plan_key) values ('" + workspace + "','" + user + "','personal');" +
    "insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference) values ('" + workspace + "','sotf_transition','" + user + "','promotion','synthetic-reference-parity');" +
    "insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by) values ('" + workspace + "','" + clientId + "','chatgpt','connected',now(),'" + user + "');" +
    "update workspace_private.product_settings set setting_value='true' where setting_key in ('mcp_dynamic_admission_enabled','sotf_v1_daily_brief_enabled');" +
    "update workspace_private.product_settings set setting_value='" + resource + "' where setting_key='mcp_resource_uri';" +
    "insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes) values ('" + user + "','" + clientId + "','" + resource + "',array['openid','email','profile']);"
  );
  initialized = true;
  process.env.SOTF_PILOT_ENABLED = "true";
  loader = await createServer({
    configFile: false, root, server: { middlewareMode: true },
    resolve: { alias: [
      { find: "server-only", replacement: root + "/tests/harness/session.ts" },
      { find: "@", replacement: root },
    ] },
  });
  const { createSotfStore } = await loader.ssrLoadModule(root + "/lib/sotf/server.ts");
  const { registerSotfV1Tools } = await loader.ssrLoadModule(root + "/lib/sotf/v1-mcp.ts");
  store = createSotfStore(db);
  const server = new McpServer({ name: "reference-parsing-parity", version: "1" });
  registerSotfV1Tools(server, db, { releaseEnabled: true });
  const client = new Client({ name: "synthetic-host", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  connections.push(server, client);
  host = client;

  await append({ type: "start_transition", timing: "Synthetic", question: "Which direction?", weeklyHours: 8, criteria: [], hypotheses: [] });
  for (const id of ["0", "1", "a-b", "a_b"]) await append(hypothesis(id));
  const projected = content(await call("sotf_get_daily_brief_state", {
    workflow_id: "transition.daily_brief", workflow_version: "1.0.0", brief_date: date, time_zone: "America/Chicago",
  }));
  assert.equal(projected.status, "ok");
  authorityToken = projected.data.authority.authority_token;
  assert.deepEqual(projected.data.projection.hypotheses.map((item) => item.id), ["0", "1", "a-b"]);

  for (let index = 0; index < corpus.length; index += 1) {
    const row = corpus[index];
    const payload = outcome(row.raw, index);
    const decision = row.accepted
      ? await assertDualAccept("[SOTF-REFERENCE:" + row.id + "]", payload)
      : await assertDualDeny("[SOTF-REFERENCE:" + row.id + "]", payload);
    if (row.accepted) {
      const refreshed = content(await call("sotf_get_daily_brief_state", {
        workflow_id: "transition.daily_brief", workflow_version: "1.0.0", brief_date: date, time_zone: "America/Chicago",
      }));
      assert.equal(refreshed.status, "ok", "authority refresh after accepted exact reference");
      authorityToken = refreshed.data.authority.authority_token;
    }
    report.cases.push({
      id: row.id, description: row.description, raw: row.raw,
      canonicalParsed: row.accepted ? row.raw : "INVALID", ...decision,
    });
  }

  const paddedWorkflowBefore = snapshot();
  const paddedHandler = await call("get_workflow", { workflow_id: " transition.daily_brief ", workflow_version: "1.0.0" });
  assert.notEqual(content(paddedHandler)?.status, "ok");
  const paddedRpc = await db.rpc("sotf_v1_authorize_workflow_retrieval", {
    p_workflow_id: " transition.daily_brief ", p_workflow_version: "1.0.0",
  });
  assert(paddedRpc.error);
  assert.equal(paddedRpc.error.code, "22023");
  assert.deepEqual(snapshot(), paddedWorkflowBefore);
  report.sameClassChecks = { paddedWorkflow: "DENY/DENY", exactProjection: ["0", "1", "a-b"], omittedReference: "a_b" };

  const paddedZone = { ...outcome("a-b", 40), request_id: randomUUID(), run_id: randomUUID(), time_zone: " America/Chicago " };
  await assertDualDeny("padded IANA time zone", paddedZone);
  const nullHost = { ...outcome("a-b", 41), request_id: randomUUID(), run_id: randomUUID(), host: null };
  await assertDualDeny("prior NULL/type regression", nullHost);
  const contradictory = { ...outcome("a-b", 42), request_id: randomUUID(), run_id: randomUUID(), degradation_reasons: [], status: "completed" };
  await assertDualDeny("prior semantic contradiction regression", contradictory);
  const paddedRequest = { ...outcome("a-b", 43), request_id: " " + randomUUID() + " ", run_id: randomUUID() };
  await assertDualDeny("padded request identity", paddedRequest);
  report.completed = new Date().toISOString();
} catch (error) {
  report.failure = { message: error.message, stack: error.stack };
  throw error;
} finally {
  for (const connection of connections.reverse()) await connection.close().catch(() => {});
  if (loader) await loader.close();
  if (initialized) {
    sql(
      "delete from workspace_private.sotf_daily_brief_outcomes where workspace_id='" + workspace + "';" +
      "delete from workspace_private.sotf_workflow_access_audit where workspace_id='" + workspace + "';" +
      "delete from workspace_private.sotf_operation_events where workspace_id='" + workspace + "';" +
      "delete from workspace_private.sotf_operation_heads where workspace_id='" + workspace + "';" +
      "delete from workspace_private.mcp_oauth_resource_grants where user_id='" + user + "';" +
      "delete from workspace.mcp_authorizations where workspace_id='" + workspace + "';" +
      "delete from workspace.bundle_entitlements where workspace_id='" + workspace + "';" +
      "delete from workspace.personal_plans where workspace_id='" + workspace + "';" +
      "delete from workspace.workspace_memberships where workspace_id='" + workspace + "';" +
      "delete from workspace.workspaces where id='" + workspace + "';" +
      "delete from workspace.user_profiles where user_id='" + user + "';" +
      "delete from auth.users where id='" + user + "';" +
      Object.entries(savedSettings).map(([key, value]) => "update workspace_private.product_settings set setting_value=" + quote(value) + " where setting_key=" + quote(key) + ";").join("")
    );
  }
  report.cleanup = {
    users: sql("select count(*) from auth.users where id='" + user + "'") ,
    workspaces: sql("select count(*) from workspace.workspaces where id='" + workspace + "'"),
    outcomes: sql("select count(*) from workspace_private.sotf_daily_brief_outcomes where workspace_id='" + workspace + "'"),
    events: sql("select count(*) from workspace_private.sotf_operation_events where workspace_id='" + workspace + "'"),
    audits: sql("select count(*) from workspace_private.sotf_workflow_access_audit where workspace_id='" + workspace + "'"),
    settingsRestored: JSON.parse(sql("select jsonb_object_agg(setting_key,setting_value) from workspace_private.product_settings where setting_key in ('sotf_v1_daily_brief_enabled','mcp_dynamic_admission_enabled','mcp_resource_uri')")),
  };
  writeFileSync(evidencePath, JSON.stringify(report, null, 2));
}

console.log(JSON.stringify({
  cases: report.cases.length, handler: report.handler, rpc: report.rpc,
  cleanup: report.cleanup, evidencePath,
}, null, 2));
