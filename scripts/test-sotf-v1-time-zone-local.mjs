import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url)).replaceAll("\\", "/").replace(/\/$/, "");
mkdirSync(join(root, ".sotf-local"), { recursive: true });
const evidencePath = process.env.SOTF_TIME_ZONE_EVIDENCE_PATH ?? join(root, ".sotf-local", "time-zone-identifier-evidence.json");
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

const user = "83111111-1111-4111-8111-111111111111";
const workspace = "83aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const clientId = "83cccccc-cccc-4ccc-8ccc-cccccccccccc";
const resource = "https://workspace.leademergence.com/api/mcp";
const surfaces = [
  "workspace_private.sotf_daily_brief_outcomes", "workspace_private.sotf_operation_events",
  "workspace_private.sotf_operation_heads", "workspace_private.sotf_workflow_access_audit",
];
const dbTest = readFileSync(join(root, "supabase/tests/database/sotf_v1_time_zone_identifier_contract.sql"), "utf8");
const corpus = JSON.parse(dbTest.split("$time_zone_corpus$")[1]);
assert.equal(corpus.length, 47);

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
    assert.equal(new URL(url).origin, status.API_URL, "time-zone runner must remain on loopback");
    const headers = new Headers(init?.headers);
    headers.set("Authorization", "Bearer " + bearer());
    return fetch(input, { ...init, headers });
  } },
  auth: { persistSession: false, autoRefreshToken: false },
});

const snapshot = () => JSON.parse(sql("select jsonb_build_object(" + surfaces.map((table) =>
  quote(table) + ",(select jsonb_build_object('count',count(*),'digest',md5(coalesce(string_agg(row_to_json(r)::text,'|' order by row_to_json(r)::text),''))) from " + table + " r)"
).join(",") + ")"));

function localDate(timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

const report = {
  head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  started: new Date().toISOString(),
  contract: "exact 418-name IANA 2025b JavaScript/PostgreSQL runtime intersection",
  cases: [], handler: { accept: 0, deny: 0 }, rpc: { accept: 0, deny: 0 },
  boundary: null, precision: null, failure: null,
};
const connections = [];
let loader;
let host;
let store;
let revision = 0;
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

const outcome = (row, authorityToken) => ({
  schema_version: "1", request_id: randomUUID(), run_id: randomUUID(),
  workflow_id: "transition.daily_brief", workflow_version: "1.0.0", expected_state_revision: revision,
  expected_authority_token: authorityToken,
  brief_date: localDate(row.accepted ? row.raw : "America/Chicago"), time_zone: row.raw,
  host: "chatgpt", execution_mode: "A", data_class: "ordinary_transition_operations", user_confirmed: true,
  status: "degraded", connector_results: { calendar_read: "not_requested", email_read: "not_requested" },
  degradation_reasons: [], selected_le_refs: [], priority_count: 0, usefulness: "not_rated",
  provenance: { source: "host_reported_user_confirmed", provider_content_persisted: false },
});

async function assertDualDeny(label, payload) {
  const before = snapshot();
  const handlerResult = await call("sotf_record_daily_brief_outcome", payload);
  assert.notEqual(content(handlerResult)?.status, "ok", label + " handler must deny");
  assert.deepEqual(snapshot(), before, label + " handler denial must not mutate");
  const { expected_authority_token, ...storedOutcome } = payload;
  const rpcResult = await db.rpc("sotf_v1_record_daily_brief_outcome", {
    outcome: storedOutcome, p_expected_authority_token: expected_authority_token,
  });
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
  const rpcResult = await db.rpc("sotf_v1_record_daily_brief_outcome", {
    outcome: storedOutcome, p_expected_authority_token: expected_authority_token,
  });
  assert.ifError(rpcResult.error);
  assert.equal(rpcResult.data?.replayed, true, label + " exact RPC retry must replay");
  assert.deepEqual(rpcResult.data?.receipt, content(handlerResult)?.data?.receipt,
    label + " application and RPC receipts must be identical");
  assert.deepEqual(snapshot(), afterHandler, label + " replay must not duplicate");
  report.handler.accept += 1;
  report.rpc.accept += 1;
  return { handler: "ACCEPT", rpc: "ACCEPT", persistence: "ONE_OUTCOME_EXACT_REPLAY", receipt: "IDENTICAL" };
}

const savedSettings = JSON.parse(sql("select jsonb_object_agg(setting_key,setting_value) from workspace_private.product_settings where setting_key in ('sotf_v1_daily_brief_enabled','mcp_dynamic_admission_enabled','mcp_resource_uri')"));
try {
  assert.equal(sql("select count(*) from auth.users"), "0", "local stack must begin without users");
  sql(
    "insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values " +
    "('00000000-0000-0000-0000-000000000000','" + user + "','authenticated','authenticated','sotf.time-zone.local@example.invalid','',now(),'{\"provider\":\"email\",\"providers\":[\"email\"]}','{}',now(),now());" +
    "insert into workspace.user_profiles(user_id,display_name) values ('" + user + "','Synthetic time-zone parity');" +
    "insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values ('" + workspace + "','personal','Synthetic time-zone parity','" + user + "');" +
    "insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values ('" + workspace + "','" + user + "','owner','active');" +
    "insert into workspace.personal_plans(workspace_id,user_id,plan_key) values ('" + workspace + "','" + user + "','personal');" +
    "insert into workspace.bundle_entitlements(workspace_id,bundle_key,beneficiary_user_id,source,source_reference) values ('" + workspace + "','sotf_transition','" + user + "','promotion','synthetic-time-zone-parity');" +
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
  const { dailyBriefWindow } = await loader.ssrLoadModule(root + "/lib/sotf/daily-brief-v1.ts");
  store = createSotfStore(db);
  const server = new McpServer({ name: "time-zone-identifier-parity", version: "1" });
  registerSotfV1Tools(server, db, { releaseEnabled: true });
  const client = new Client({ name: "synthetic-host", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  connections.push(server, client);
  host = client;

  await append({ type: "start_transition", timing: "Synthetic", question: "Which direction?", weeklyHours: 8, criteria: [], hypotheses: [] });
  for (const row of corpus) {
    let authorityToken = "sha256:" + "0".repeat(64);
    if (row.accepted) {
      const state = content(await call("sotf_get_daily_brief_state", {
        workflow_id: "transition.daily_brief", workflow_version: "1.0.0",
        brief_date: localDate(row.raw), time_zone: row.raw,
      }));
      assert.equal(state?.status, "ok", "accepted zone must retrieve database authority: " + row.raw);
      authorityToken = state.data.authority.authority_token;
    }
    const payload = outcome(row, authorityToken);
    const decision = row.accepted
      ? await assertDualAccept("[SOTF-TIME-ZONE:" + row.id + "]", payload)
      : await assertDualDeny("[SOTF-TIME-ZONE:" + row.id + "]", payload);
    report.cases.push({ id: row.id, description: row.description, raw: row.raw, ...decision });
  }

  const exactInput = {
    workflow_id: "transition.daily_brief", workflow_version: "1.0.0",
    brief_date: "2026-09-13", time_zone: "America/Asuncion",
  };
  const nodeWindow = dailyBriefWindow(exactInput.brief_date, exactInput.time_zone, new Date("2026-09-13T12:00:00.000Z"));
  const databaseWindowEnd = sql("select to_char(('2026-09-15'::timestamp at time zone 'America/Asuncion') at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')");
  assert.equal(nodeWindow.window_end, "2026-09-15T03:00:00.000Z", "preserve the reported Node/ICU reproduction");
  assert.equal(databaseWindowEnd, "2026-09-15T04:00:00.000Z", "preserve the reported PostgreSQL reproduction");
  await append({
    type: "record_meeting", meeting: {
      id: "asuncion-exact-boundary", title: "Exact Asuncion boundary meeting", hypothesisIds: [], kind: "networking",
      startsAt: "2026-09-15T03:15:00.000Z", endsAt: "2026-09-15T03:45:00.000Z",
      status: "accepted", provider: "manual", objective: "Exercise the exact database boundary",
    },
  });
  const exactState = content(await call("sotf_get_daily_brief_state", exactInput));
  assert.equal(exactState?.status, "ok", "exact Asuncion state read must succeed");
  assert.equal(exactState.data.projection.window_end, databaseWindowEnd);
  assert(exactState.data.projection.meetings.some((meeting) => meeting.id === "asuncion-exact-boundary"),
    "application projection must consume the database boundary and include the exact meeting");
  const exactPayload = {
    ...outcome({ raw: "America/Asuncion", accepted: true }, exactState.data.authority.authority_token),
    brief_date: exactInput.brief_date,
    selected_le_refs: [{ entity_type: "meeting", entity_id: "asuncion-exact-boundary" }],
    priority_count: 1,
  };
  const exactDecision = await assertDualAccept("[SOTF-BOUNDARY:ASUNCION-EXACT]", exactPayload);
  report.boundary = {
    node: { version: process.version, icu: process.versions.icu, tzdb: process.versions.tz, window_end: nodeWindow.window_end },
    postgres: { version: sql("show server_version"), tzdb: execFileSync(docker, ["exec", "supabase_db_lead-emergence-workspace-local", "sh", "-lc", "head -n 1 /usr/share/zoneinfo/tzdata.zi"], { encoding: "utf8" }).trim(), window_end: databaseWindowEnd },
    meeting: { starts_at: "2026-09-15T03:15:00.000Z", ends_at: "2026-09-15T03:45:00.000Z" },
    application_projection: "ELIGIBLE", ...exactDecision,
  };

  const precisionDay = localDate("UTC");
  const precisionInput = {
    workflow_id: "transition.daily_brief", workflow_version: "1.0.0",
    brief_date: precisionDay, time_zone: "UTC",
  };
  const precisionStart = new Date(Date.parse(`${precisionDay}T00:00:00.000Z`) - 60_000).toISOString();
  const precisionRawEnd = `${precisionDay}T00:00:00.000500Z`;
  const precisionRequestId = randomUUID();
  const precisionAppend = await db.rpc("sotf_append_operation", { operation: {
    requestId: precisionRequestId, expectedRevision: revision, userConfirmed: true,
    dataClass: "ordinary_transition_operations",
    command: { type: "record_meeting", meeting: {
      id: "precision-boundary", title: "Synthetic precision boundary", hypothesisIds: [], kind: "networking",
      startsAt: precisionStart, endsAt: precisionRawEnd, status: "accepted", provider: "manual",
      objective: "Exercise PostgreSQL-native timestamp precision",
    } },
  } });
  assert.ifError(precisionAppend.error);
  revision = precisionAppend.data.revision;
  const storedRawEnd = sql(
    "select envelope #>> '{command,meeting,endsAt}' from workspace_private.sotf_operation_events"
      + " where workspace_id='" + workspace + "' and request_id='" + precisionRequestId + "'",
  );
  const serializedBatch = await db.rpc("sotf_read_operations");
  assert.ifError(serializedBatch.error);
  const serializedRawEnd = serializedBatch.data.events.find((event) => event.envelope.requestId === precisionRequestId)
    ?.envelope.command.meeting.endsAt;
  const replayedState = await store.read();
  const applicationEnd = replayedState.state.meetings.find((meeting) => meeting.id === "precision-boundary")?.endsAt;
  assert.equal(storedRawEnd, precisionRawEnd, "PostgreSQL JSON retains the exact six-digit timestamp");
  assert.equal(serializedRawEnd, precisionRawEnd, "PostgREST/RPC serialization retains the exact six-digit timestamp");
  assert.equal(applicationEnd, `${precisionDay}T00:00:00.000Z`,
    "application presentation normalization documents the millisecond representation");

  const precisionState = content(await call("sotf_get_daily_brief_state", precisionInput));
  assert.equal(precisionState?.status, "ok", "DB-authorized sub-millisecond state read must succeed");
  assert(precisionState.data.projection.meetings.some((meeting) => meeting.id === "precision-boundary"),
    "application projection must consume the database membership");
  const precisionAuthority = await db.rpc("sotf_v1_get_daily_brief_authority", {
    p_workflow_id: precisionInput.workflow_id, p_workflow_version: precisionInput.workflow_version,
    p_brief_date: precisionInput.brief_date, p_time_zone: precisionInput.time_zone,
  });
  assert.ifError(precisionAuthority.error);
  assert(precisionAuthority.data.eligible_refs.some((reference) =>
    reference.entity_type === "meeting" && reference.entity_id === "precision-boundary"));
  const precisionPayload = {
    ...outcome({ raw: "UTC", accepted: true }, precisionState.data.authority.authority_token),
    brief_date: precisionDay,
    selected_le_refs: [{ entity_type: "meeting", entity_id: "precision-boundary" }],
    priority_count: 1,
  };
  const precisionDecision = await assertDualAccept("[SOTF-PRECISION:.000500Z]", precisionPayload);
  report.precision = {
    raw_database_timestamp: storedRawEnd,
    rpc_serialized_timestamp: serializedRawEnd,
    application_representation: applicationEnd,
    database_eligibility: "ELIGIBLE",
    application_projection: "ELIGIBLE_FROM_DB_AUTHORITY",
    ...precisionDecision,
  };
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
    users: sql("select count(*) from auth.users where id='" + user + "'"),
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
