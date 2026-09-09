import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { appUrl, localConfiguration, localSql, fixtureSession } from "./bundle-local-runtime.mjs";
import { localOAuth } from "./bundle-local-oauth.mjs";
import { investorFixtures } from "./investor-fixtures.mjs";
const config = await localConfiguration(), f = JSON.parse(await readFile(".bundle-local/fixtures.json", "utf8"));
const actor = await fixtureSession(config, f.investor), other = await fixtureSession(config, f.investorOther), dual = await fixtureSession(config, f.investorDual);
const outsiders = await Promise.all([f.reader, f.writer, f.minister, f.founder].map(x => fixtureSession(config, x)));
const data = investorFixtures(), created = [], proposals = [], connections = [];
let disabled = false, groups = 0;
const pass = name => { groups++; console.log("PASS " + name); };
async function rpc(name, args = {}, code = null, client = actor.client) { const r = await client.rpc(name, args); assert.equal(r.error?.code ?? null, code, JSON.stringify(r.error)); return r.data; }
async function web(path, body, token = actor.token) { const r = await fetch(appUrl + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, headers: r.headers, body: await r.json() }; }
const saveArgs = (kind, value, doc = null) => ({ p_kind: kind, p_document_id: doc?.id ?? null, p_expected_revision: doc?.revision ?? 0, p_request_id: randomUUID(), p_data: value, p_confirm_research_only: true });
const proposalArgs = (kind, value, doc = null) => ({ p_kind: kind, p_document_id: doc?.id ?? null, p_expected_revision: doc?.revision ?? 0, p_request_id: randomUUID(), p_data: value, p_reason: "Requested fictional research review.", p_evidence: "Fictional acceptance evidence, not financial guidance.", p_scope: "public_research_only" });
async function create(kind, value, client = actor.client) { const d = (await rpc("investor_save_document", saveArgs(kind, value), null, client)).document; created.push(d.id); return d; }
async function propose(args) { const p = await rpc("investor_propose_document", args); proposals.push(p.id); return p; }
async function decide(p, decision = "approve") { const r = await rpc("investor_decide_proposal", { p_proposal_id: p.id, p_expected_revision: p.baseRevision, p_decision: decision, p_confirm_research_only: decision === "approve" }); if (r.document) created.push(r.document.id); return r; }
async function connect(token) { const c = new Client({ name: "synthetic-investor-acceptance", version: "1" }); await c.connect(new StreamableHTTPClientTransport(new URL(appUrl + "/api/mcp"), { requestInit: { headers: { Authorization: "Bearer " + token } } })); connections.push(c); return c; }
try {
  const docs = {};
  for (const kind of Object.keys(data)) docs[kind] = await create(kind, data[kind]);
  const foreign = await create("thesis", { ...data.thesis, title: "PRIVATE_OTHER_INVESTOR" }, other.client);
  for (const [kind, d] of Object.entries(docs)) {
    assert.deepEqual((await rpc("investor_get_document", { p_kind: kind, p_document_id: d.id })).document, d);
    assert.equal((await rpc("investor_search_documents", { p_kind: kind, p_search: "SYNTHETIC_INVESTOR_" + kind.toUpperCase() + "_MARKER" })).documents.some(x => x.id === d.id), true);
    for (const outsider of outsiders) await rpc("investor_get_document", { p_kind: kind, p_document_id: d.id }, "42501", outsider.client);
  }
  await rpc("investor_get_document", { p_kind: "thesis", p_document_id: foreign.id }, "P0002");
  await rpc("investor_get_document", { p_kind: "filing", p_document_id: docs.thesis.id }, "P0002");
  const dualDoc = await create("thesis", data.thesis, dual.client);
  await rpc("writer_get_resource", { resource_id: dualDoc.id }, "P0002", dual.client);
  await rpc("ministry_get_document", { p_kind: "research", p_document_id: dualDoc.id }, "P0002", dual.client);
  await rpc("nonprofit_get_document", { p_kind: "research", p_document_id: dualDoc.id }, "P0002", dual.client);
  pass("four real SQL research kinds, search, tenant isolation and same-user cross-domain isolation");

  const bad = [
    ["watchlist", { ...data.watchlist, accountNumber: "forbidden" }], ["thesis", { ...data.thesis, trade: { buy: true } }],
    ["thesis", { ...data.thesis, title: null }], ["thesis", { ...data.thesis, title: " " }], ["thesis", { ...data.thesis, title: "🙂".repeat(121) }],
    ["thesis", { ...data.thesis, asOfDate: "2026-02-30" }], ["thesis", { ...data.thesis, confidence: "50" }],
    ["thesis", { ...data.thesis, claims: [{ ...data.thesis.claims[0], sourceIds: [] }] }],
    ["thesis", { ...data.thesis, claims: [{ ...data.thesis.claims[0], sourceIds: [randomUUID()] }] }],
    ["thesis", { ...data.thesis, claims: [{ ...data.thesis.claims[0], sourceIds: [data.thesis.sources[0].id, data.thesis.sources[0].id] }] }],
    ["thesis", { ...data.thesis, sources: [data.thesis.sources[0], data.thesis.sources[0]] }],
    ["thesis", { ...data.thesis, sources: [{ ...data.thesis.sources[0], url: "https://user:secret@example.org/" }] }],
    ["thesis", { ...data.thesis, sources: [{ ...data.thesis.sources[0], url: "javascript:alert(1)" }] }],
    ["thesis", { ...data.thesis, sources: [{ ...data.thesis.sources[0], retrievedAt: null }] }],
    ["thesis", { ...data.thesis, catalysts: [{ ...data.thesis.catalysts[0], dateState: "announced", sourceIds: [] }] }],
    ["thesis", { ...data.thesis, invalidations: [{ ...data.thesis.invalidations[0], status: "triggered" }] }],
    ["thesis", { ...data.thesis, changeAssessment: "no_material_change", sources: [], claims: [], changeReason: "" }],
    ["watchlist", { ...data.watchlist, entries: [data.watchlist.entries[0], { ...data.watchlist.entries[0], id: randomUUID() }] }],
    ["watchlist", { ...data.watchlist, entries: [{ ...data.watchlist.entries[0], instrument: { ...data.watchlist.entries[0].instrument, cik: "0000000000" } }] }],
    ["filing", { ...data.filing, periodEnd: null }], ["filing", { ...data.filing, holdingsLimitations: "" }],
    ["filing", { ...data.filing, periodEnd: "2026-09-09" }], ["brief", { ...data.brief, periodStart: "2026-09-09" }]
  ];
  for (const [kind, value] of bad) await rpc("investor_save_document", saveArgs(kind, value), "22023");
  await rpc("investor_save_document", { ...saveArgs("thesis", data.thesis), p_confirm_research_only: false }, "22023");
  const scenario = { id: randomUUID(), title: "Fictional outcome", assumptions: "User-specified hypothetical assumption.", outcome: "Illustrative result.", probability: 50, returnPercent: null, invalidatedBy: "Contradictory public evidence." };
  for (const scenarios of [[scenario], [scenario, { ...scenario, id: randomUUID(), probability: null }], [scenario, { ...scenario, id: randomUUID(), probability: 60 }]])
    await rpc("investor_save_document", saveArgs("thesis", { ...data.thesis, scenarioMode: "exclusive_complete", scenarios }), "22023");
  await create("thesis", { ...data.thesis, scenarioMode: "exclusive_complete", scenarios: [scenario, { ...scenario, id: randomUUID() }] });
  pass("SQL independently rejects unsupported account/trade fields, malformed dates, unsafe sources, unsupported conclusions and invalid scenario sets");

  const retry = saveArgs("thesis", { ...data.thesis, thesis: "Exact recoverable second revision." }, docs.thesis);
  docs.thesis = (await rpc("investor_save_document", retry)).document;
  assert.equal((await rpc("investor_save_document", retry)).document.revision, 2);
  await rpc("investor_save_document", { ...retry, p_data: data.thesis }, "40001");
  const races = await Promise.all(["Concurrent A", "Concurrent B"].map(title => actor.client.rpc("investor_save_document", saveArgs("thesis", { ...docs.thesis.data, title }, docs.thesis))));
  assert.deepEqual(races.map(r => r.error?.code ?? "OK").sort(), ["40001", "OK"]);
  docs.thesis = (await rpc("investor_get_document", { p_kind: "thesis", p_document_id: docs.thesis.id })).document;
  await rpc("investor_save_document", retry, "40001");
  const history = await rpc("investor_document_history", { p_kind: "thesis", p_document_id: docs.thesis.id });
  assert.deepEqual(history.revisions.at(-1).data, data.thesis);
  pass("exact idempotent retries, concurrent stale-write rejection and recoverable original versions");

  for (const [kind, d] of Object.entries(docs)) { const result = await web("/api/investor/" + kind + "/" + d.id); assert.equal(result.status, 200, JSON.stringify(result.body)); assert.deepEqual(result.body.document, d); assert.match(result.headers.get("cache-control"), /no-store/); }
  for (const path of ["/api/investor/thesis?workspaceId=" + f.investorOther.workspaceId, "/api/investor/thesis?limit=2&limit=3", "/api/investor/thesis?limit=Infinity", "/api/investor/public-filings?cik=0000000001&url=https://evil.invalid", "/api/investor/public-filings?cik=0000000001&cik=0000000002"])
    assert.equal((await web(path)).status, 400);
  assert.equal((await web("/api/investor/thesis", null, null)).status, 401);
  assert.equal((await web("/api/investor/thesis", null, outsiders[0].token)).status, 403);
  assert.equal((await web("/api/investor/thesis/" + foreign.id)).status, 404);
  assert.equal((await web("/api/investor/filing", { kind: "thesis", documentId: null, expectedRevision: 0, requestId: randomUUID(), data: data.thesis, confirmResearchOnly: true })).status, 400);
  const saved = await web("/api/investor/watchlist", { kind: "watchlist", documentId: docs.watchlist.id, expectedRevision: 1, requestId: randomUUID(), data: { ...data.watchlist, purpose: "Actual native API revision." }, confirmResearchOnly: true });
  assert.equal(saved.status, 200, JSON.stringify(saved.body)); docs.watchlist = saved.body.document;
  const composition = JSON.stringify((await web("/api/bundles/experience", null, dual.token)).body);
  for (const area of ["/workspace/investing", "/workspace/nonprofit", "/workspace/ministry", "/workspace/writing"]) assert.equal(composition.includes(area), true, area);
  pass("real private native APIs, strict queries/bodies and four-bundle composition");

  let pending = await propose(proposalArgs("brief", { ...data.brief, title: "New proposed brief " + randomUUID() }));
  assert.equal((await rpc("investor_search_documents", { p_kind: "brief", p_search: '"' + pending.data.title + '"' })).total, 0);
  await rpc("investor_decide_proposal", { p_proposal_id: pending.id, p_expected_revision: 0, p_decision: "approve", p_confirm_research_only: false }, "22023");
  await rpc("investor_decide_proposal", { p_proposal_id: pending.id, p_expected_revision: 0, p_decision: "approve", p_confirm_research_only: true }, "P0002", other.client);
  const approved = await decide(pending); assert.equal(approved.document.revision, 1); assert.equal((await decide(pending)).document.id, approved.document.id);
  assert.equal((await rpc("investor_list_proposals", { p_kind: "brief", p_status: "approved" })).proposals.some(p => p.id === pending.id), true);
  pending = await propose(proposalArgs("watchlist", { ...data.watchlist, title: "Rejected but retained" }));
  const rejected = await decide(pending, "reject"); assert.equal(rejected.document, null); assert.equal(rejected.proposal.status, "rejected");
  assert.equal((await rpc("investor_list_proposals", { p_kind: "watchlist", p_status: "rejected" })).proposals.some(p => p.id === pending.id), true);
  const stale = await propose(proposalArgs("watchlist", { ...docs.watchlist.data, purpose: "Stale proposal" }, docs.watchlist));
  docs.watchlist = (await rpc("investor_save_document", saveArgs("watchlist", { ...docs.watchlist.data, purpose: "Newer native revision." }, docs.watchlist))).document;
  await rpc("investor_decide_proposal", { p_proposal_id: stale.id, p_expected_revision: stale.baseRevision, p_decision: "approve", p_confirm_research_only: true }, "40001");
  await decide(stale, "reject");
  pass("proposals remain noncanonical until native approval; rejection, stale decisions and originals stay recoverable");

  const attention = await rpc("investor_next_moves");
  for (const kind of Object.keys(data)) assert.equal(attention.items.some(x => x.kind === kind), true, kind);
  assert.equal(attention.items.some(x => x.documentId === foreign.id), false);
  assert.equal(attention.items.every(x => x.reason && x.evidence && x.revision > 0), true);
  pass("attention is based on dated, tenant-scoped saved research, not a live scan");

  const oauth = await localOAuth(config, f.investor), assistant = await connect(oauth.token);
  const oauthDb = createClient(config.API_URL, config.ANON_KEY, { db: { schema: "workspace" }, auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: "Bearer " + oauth.token } } });
  const tools = (await assistant.listTools()).tools.filter(x => x.name.startsWith("investor_"));
  assert.equal(tools.length, 14); assert.deepEqual(tools.filter(x => !x.annotations.readOnlyHint).map(x => x.name).sort(), ["investor_propose_brief", "investor_propose_filing", "investor_propose_thesis", "investor_propose_watchlist"]);
  assert.deepEqual(tools.filter(x => x.annotations.openWorldHint).map(x => x.name), ["investor_public_filings"]);
  for (const [kind, d] of Object.entries(docs)) {
    const listed = await assistant.callTool({ name: "investor_list_" + (kind === "thesis" ? "theses" : kind + "s"), arguments: { search: "", limit: 25, offset: 0 } });
    assert.equal(listed.isError ?? false, false); assert.equal(listed.structuredContent.documents.some(x => x.id === d.id), true);
    const result = await assistant.callTool({ name: "investor_get_" + kind, arguments: { documentId: d.id } }); assert.equal(result.isError ?? false, false); assert.deepEqual(result.structuredContent.document, d);
    if (kind !== "thesis") { const proposed = await assistant.callTool({ name: "investor_propose_" + kind, arguments: { documentId: null, expectedRevision: 0, requestId: randomUUID(), data: d.data, reason: "Requested fictional record.", evidence: "Fictional evidence only.", scope: "public_research_only" } });
      assert.equal(proposed.isError ?? false, false, JSON.stringify(proposed)); proposals.push(proposed.structuredContent.id); assert.equal(proposed.structuredContent.origin, "assistant"); await decide(proposed.structuredContent, "reject"); }
  }
  const denied = await assistant.callTool({ name: "investor_get_thesis", arguments: { documentId: foreign.id } }); assert.equal(denied.isError, true); assert.equal(JSON.stringify(denied).includes("PRIVATE_OTHER_INVESTOR"), false);
  assert.equal((await assistant.callTool({ name: "investor_next_moves", arguments: {} })).isError ?? false, false);
  assert.equal((await assistant.callTool({ name: "investor_public_filings", arguments: { cik: "0000000001", url: "https://evil.invalid" } })).isError, true);
  pass("actual OAuth consent/PKCE and 14 accurately scoped HTTP MCP tools; no account or trading tool");

  const proposedInput = { documentId: docs.thesis.id, expectedRevision: docs.thesis.revision, requestId: randomUUID(), data: { ...docs.thesis.data, sources: docs.thesis.data.sources.map(s => ({ ...s, excerpt: "Changed fictional evidence." })) }, reason: "Requested evidence correction.", evidence: "A fictional source changed; prior claims need review.", scope: "public_research_only" };
  const result = await assistant.callTool({ name: "investor_propose_thesis", arguments: proposedInput }); assert.equal(result.isError ?? false, false, JSON.stringify(result));
  const p = result.structuredContent; proposals.push(p.id); assert.equal(p.data.status, "review_required"); assert.equal(p.data.sources[0].status, "unverified"); assert.equal(p.data.claims[0].epistemicState, "inferred");
  assert.equal((await assistant.callTool({ name: "investor_propose_thesis", arguments: proposedInput })).structuredContent.id, p.id);
  assert.equal((await rpc("investor_get_document", { p_kind: "thesis", p_document_id: docs.thesis.id })).document.data.claims[0].epistemicState, "confirmed");
  docs.thesis = (await decide(p)).document; assert.equal(docs.thesis.data.claims[0].epistemicState, "inferred");
  assert.equal((await assistant.callTool({ name: "investor_propose_thesis", arguments: proposedInput })).structuredContent.id, p.id);
  await rpc("investor_save_document", saveArgs("thesis", data.thesis), "42501", oauthDb);
  await rpc("investor_decide_proposal", { p_proposal_id: p.id, p_expected_revision: p.baseRevision, p_decision: "approve", p_confirm_research_only: true }, "42501", oauthDb);
  await rpc("investor_document_history", { p_kind: "thesis", p_document_id: docs.thesis.id }, "42501", oauthDb);
  await rpc("investor_list_proposals", { p_kind: "thesis" }, "42501", oauthDb);
  pass("changed evidence invalidates dependent confirmations, uses immutable-base retries and never grants assistant canonical authority");

  localSql("update workspace.bundle_capabilities set enabled=false where bundle_key='investor' and capability_key='investor_company_research';"); disabled = true;
  assert.equal((await web("/api/investor/watchlist/" + docs.watchlist.id)).status, 403);
  assert.equal((await assistant.callTool({ name: "investor_get_watchlist", arguments: { documentId: docs.watchlist.id } })).isError, true);
  assert.equal((await rpc("investor_next_moves")).items.some(x => x.kind === "watchlist" || x.kind === "brief"), false);
  const after = JSON.stringify((await web("/api/bundles/experience")).body);
  assert.equal(after.includes('"route":"/workspace/investing"'), true); assert.equal(after.includes('"route":"/workspace/investing/watchlist"'), false);
  assert.equal((await web("/api/investor/filing/" + docs.filing.id)).status, 200);
  localSql("update workspace.bundle_capabilities set enabled=true where bundle_key='investor' and capability_key='investor_company_research';"); disabled = false;
  pass("selective revocation closes private APIs/tools/attention while keeping admitted research reachable");

  await rpc("investor_public_source_access", { p_reserve: true }, "42501", outsiders[0].client);
  for (let i = 0; i < 10; i++) { await new Promise(resolve => setTimeout(resolve, 270)); await rpc("investor_public_source_access", { p_reserve: true }); }
  await new Promise(resolve => setTimeout(resolve, 270)); await rpc("investor_public_source_access", { p_reserve: true }, "54000");
  await rpc("investor_public_source_access", { p_reserve: false });
  pass("public-source reads require live access and enforce a private per-workspace request budget without fetching externally");

  const disconnect = await actor.client.rpc("disconnect_personal_mcp", { target_client_id: oauth.clientId }); assert.equal(disconnect.error, null);
  const blocked = await fetch(appUrl + "/api/mcp", { method: "POST", headers: { Authorization: "Bearer " + oauth.token, "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 101, method: "tools/list", params: {} }) }); assert.equal(blocked.status, 401);
  const readerOAuth = await localOAuth(config, f.reader), readerAssistant = await connect(readerOAuth.token);
  assert.equal((await readerAssistant.listTools()).tools.some(x => x.name.startsWith("investor_")), false);
  pass("disconnected assistants fail closed and unassigned users are not advertised Investor tools");
  console.log("Investor connected acceptance: " + groups + " groups passed. No live SEC or personal-account read was performed by this suite.");
} finally {
  if (disabled) localSql("update workspace.bundle_capabilities set enabled=true where bundle_key='investor' and capability_key='investor_company_research';");
  for (const c of connections) await c.close().catch(() => {});
  if (proposals.length) localSql("delete from workspace_private.investor_proposals where id in (" + [...new Set(proposals)].map(id => "'" + id + "'").join(",") + ");");
  if (created.length) localSql("delete from workspace_private.investor_documents where id in (" + [...new Set(created)].map(id => "'" + id + "'").join(",") + ");");
  localSql("delete from workspace_private.investor_source_budgets where workspace_id='" + f.investor.workspaceId + "';");
}
