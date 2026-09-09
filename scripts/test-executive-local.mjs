import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { localConfiguration, localSql, fixtureSession, publicClient } from "./bundle-local-runtime.mjs";
import { executiveFixtures } from "./executive-fixtures.mjs";
import { investorFixtures } from "./investor-fixtures.mjs";
const config = await localConfiguration();
const fixtures = JSON.parse(await readFile(".bundle-local/fixtures.json", "utf8"));
for (const key of ["executive", "executiveOther", "executiveDual"]) assert.ok(fixtures[key], "Seed Executive fixtures first.");
const own = await fixtureSession(config, fixtures.executive), other = await fixtureSession(config, fixtures.executiveOther);
const dual = await fixtureSession(config, fixtures.executiveDual), unassigned = await fixtureSession(config, fixtures.writer);
const operator = await fixtureSession(config, fixtures.operator);
const data = executiveFixtures();
let groups = 0;
const pass = message => { groups++; console.log("PASS " + message); };
async function rpc(client, name, params = {}) {
  const result = await client.rpc(name, params); assert.equal(result.error, null, name + ": " + result.error?.message); return result.data;
}
async function denied(client, name, params, code) {
  const result = await client.rpc(name, params); assert.equal(result.error?.code, code, name + " should deny with " + code);
}
const saveInput = (kind, content = data[kind]) => ({ p_kind: kind, p_document_id: null, p_expected_revision: 0,
  p_request_id: randomUUID(), p_data: content, p_confirm_exact_record: true });
const records = {};
for (const kind of Object.keys(data)) {
  const params = saveInput(kind), result = await rpc(own.client, "executive_save_document", params);
  assert.equal(result.document.kind, kind); assert.equal(result.document.data.recordType, kind); assert.equal(result.document.revision, 1);
  const retry = await rpc(own.client, "executive_save_document", params); assert.equal(retry.document.id, result.document.id);
  const current = await rpc(own.client, "executive_get_document", { p_kind: kind, p_document_id: result.document.id });
  assert.deepEqual(current.document.data, data[kind]); records[kind] = result.document;
  await denied(other.client, "executive_get_document", { p_kind: kind, p_document_id: result.document.id }, "P0002");
  await denied(unassigned.client, "executive_get_document", { p_kind: kind, p_document_id: result.document.id }, "42501");
}
await denied(publicClient(config), "executive_search_documents", { p_kind: "commitment" }, "42501");
await denied(own.client, "executive_get_document", { p_kind: "decision", p_document_id: records.commitment.id }, "P0002");
pass("five real native record kinds, exact retries, cross-client/kind denial and absent entitlement fail closed");
for (const patch of [{ p_confirm_exact_record: false }, { p_data: { ...data.commitment, tenantId: fixtures.executiveOther.workspaceId } },
  { p_data: { ...data.commitment, state: "completed" } }, { p_data: { ...data.commitment, state: "blocked" } },
  { p_data: { ...data.commitment, dueDate: "2026-02-30" } }, { p_data: { ...data.meeting, recordType: "commitment" } }])
  await denied(own.client, "executive_save_document", { ...saveInput("commitment"), ...patch }, "22023");
await denied(own.client, "executive_save_document", saveInput("meeting", { ...data.meeting, durationMinutes: 30.5 }), "22023");
await denied(own.client, "executive_save_document", saveInput("meeting", { ...data.meeting, timeZone: "Bad/Zone" }), "22023");
await denied(own.client, "executive_save_document", saveInput("daily_brief", { ...data.daily_brief, periodEnd: "2026-09-20" }), "22023");
pass("the database independently checks strict fields, confirmation, real dates, integers, zones and evidence rules");

const changed = { ...data.commitment, nextAction: "An updated illustrative next move" };
const update = { ...saveInput("commitment", changed), p_document_id: records.commitment.id, p_expected_revision: 1 };
const concurrent = await Promise.all([own.client.rpc("executive_save_document", update), own.client.rpc("executive_save_document", { ...update, p_request_id: randomUUID() })]);
assert.equal(concurrent.filter(x => !x.error).length, 1); assert.equal(concurrent.find(x => x.error)?.error.code, "40001");
const history = await rpc(own.client, "executive_document_history", { p_kind: "commitment", p_document_id: records.commitment.id });
assert.equal(history.revisions.length, 2); assert.deepEqual(history.revisions.find(x => x.revision === 1).data, data.commitment);
pass("concurrent edits have one winner while preserving the original saved revision");

const proposalInput = { p_kind: "decision", p_document_id: records.decision.id, p_expected_revision: 1, p_request_id: randomUUID(),
  p_data: { ...data.decision, nextAction: "Compare the explicit alternatives" }, p_reason: "Requested clarification", p_evidence: "Synthetic user statement", p_scope: "executive_coordination_only" };
const proposal = await rpc(own.client, "executive_propose_document", proposalInput);
assert.equal(proposal.status, "pending");
const approved = await rpc(own.client, "executive_decide_proposal", { p_proposal_id: proposal.id, p_expected_revision: 1, p_decision: "approve", p_confirm_exact_record: true });
assert.equal(approved.document.revision, 2);
assert.equal((await rpc(own.client, "executive_propose_document", proposalInput)).id, proposal.id);
await denied(other.client, "executive_decide_proposal", { p_proposal_id: proposal.id, p_expected_revision: 1, p_decision: "approve", p_confirm_exact_record: true }, "P0002");
const stale = await rpc(own.client, "executive_propose_document", { ...proposalInput, p_request_id: randomUUID(), p_expected_revision: 2 });
await rpc(own.client, "executive_save_document", { ...saveInput("decision", { ...data.decision, nextAction: "Native newer edit" }), p_document_id: records.decision.id, p_expected_revision: 2 });
await denied(own.client, "executive_decide_proposal", { p_proposal_id: stale.id, p_expected_revision: 2, p_decision: "approve", p_confirm_exact_record: true }, "40001");
assert.equal((await rpc(own.client, "executive_decide_proposal", { p_proposal_id: stale.id, p_expected_revision: 2, p_decision: "reject", p_confirm_exact_record: false })).proposal.status, "rejected");
pass("actual pending/approved/rejected proposals preserve exact bases and reject stale or other-client decisions");

assert.deepEqual(await rpc(own.client, "executive_get_source_permissions"), { revision: 0, sourceCapabilities: [], updatedAt: null });
await denied(own.client, "executive_set_source_permissions", { p_capabilities: ["writer.resource.library"], p_expected_revision: 0,
  p_request_id: randomUUID(), p_confirm_task_metadata_only: true }, "42501");
let sharing = await rpc(dual.client, "executive_get_source_permissions");
async function share(capabilities, expected = sharing.revision, requestId = randomUUID(), confirm = true) {
  const result = await rpc(dual.client, "executive_set_source_permissions", { p_capabilities: capabilities, p_expected_revision: expected,
    p_request_id: requestId, p_confirm_task_metadata_only: confirm }); sharing = result; return result;
}
if (sharing.sourceCapabilities.length) await share([]);
const sourceRecords = [
  { capabilityId: "writer.resource.library", kind: "resource", documentId: randomUUID(), revision: 1 },
  { capabilityId: "ministry.research", kind: "research", documentId: randomUUID(), revision: 1 },
  { capabilityId: "nonprofit.roadmap", kind: "plan", documentId: randomUUID(), revision: 1 },
  { capabilityId: "investor.thesis", kind: "thesis", documentId: randomUUID(), revision: 1 }
];
const target = fixtures.executiveDual.workspaceId;
assert.match(target, /^[0-9a-f-]{36}$/);
const writing = await rpc(dual.client, "writer_import_resource", { request_id: randomUUID(), resource_input:
  { title: "Fictional Writing task", source_label: "Synthetic acceptance", body_text: "PRIVATE_CANARY_MANUSCRIPT" } });
sourceRecords[0].documentId = writing.resourceId;
const ministry = await rpc(dual.client, "ministry_save_document", { p_kind: "research", p_document_id: null, p_expected_revision: 0,
  p_request_id: randomUUID(), p_confirm_profile: false, p_data: { title: "Fictional Ministry task", question: "An illustrative question",
    passage: "", audience: "", dueDate: "2026-09-09", status: "researching", sources: [], notes: [], teachingOutline: "PRIVATE_CANARY_THEOLOGY" } });
sourceRecords[1].documentId = ministry.document.id;
const nonprofit = await rpc(dual.client, "nonprofit_save_document", { p_kind: "plan", p_document_id: null, p_expected_revision: 0,
  p_request_id: randomUUID(), p_confirm_administrative: true, p_data: { title: "Fictional Nonprofit task",
    mission: "PRIVATE_CANARY_OPERATIONS", jurisdiction: "Illustrative jurisdiction", status: "active", targetDate: "2026-09-09", milestones: [] } });
sourceRecords[2].documentId = nonprofit.document.id;
const investor = await rpc(dual.client, "investor_save_document", { p_kind: "thesis", p_document_id: null, p_expected_revision: 0,
  p_request_id: randomUUID(), p_confirm_research_only: true,
  p_data: { ...investorFixtures().thesis, title: "Fictional Investor task", thesis: "PRIVATE_CANARY_RESEARCH" } });
sourceRecords[3].documentId = investor.document.id;
const resolve = refs => rpc(dual.client, "executive_resolve_references", { p_references: refs });
assert.ok((await resolve(sourceRecords)).references.every(x => x.state === "unavailable" && x.metadata === null));
await denied(dual.client, "executive_set_source_permissions", { p_capabilities: ["writer.resource.library"], p_expected_revision: sharing.revision,
  p_request_id: randomUUID(), p_confirm_task_metadata_only: false }, "22023");
await denied(dual.client, "executive_set_source_permissions", { p_capabilities: ["ministry.profile"], p_expected_revision: sharing.revision,
  p_request_id: randomUUID(), p_confirm_task_metadata_only: true }, "22023");
const exactRequest = randomUUID(), baseSharing = sharing.revision;
const selected = sourceRecords.map(x => x.capabilityId);
await share(selected, baseSharing, exactRequest); const selectedRevision = sharing.revision;
await share([...selected].reverse(), baseSharing, exactRequest); assert.equal(sharing.revision, selectedRevision);
await denied(dual.client, "executive_set_source_permissions", { p_capabilities: [], p_expected_revision: baseSharing,
  p_request_id: randomUUID(), p_confirm_task_metadata_only: true }, "40001");
pass("sharing starts off, requires exact native confirmation and source entitlement, and detects stale settings");

const resolved = await resolve(sourceRecords);
assert.ok(resolved.references.every(x => x.state === "current" && x.metadata.revision === 1));
assert.doesNotMatch(JSON.stringify(resolved), /PRIVATE_CANARY|privateBody|body_text|theologicalProfile/);
for (const item of resolved.references) assert.deepEqual(Object.keys(item.metadata).sort(), ["title", "state", "reviewState", "revision", "dueDate", "sourceUpdatedAt"].sort());
assert.ok((await rpc(other.client, "executive_resolve_references", { p_references: sourceRecords })).references.every(x => x.metadata === null));
await denied(dual.client, "executive_get_document", { p_kind: "commitment", p_document_id: sourceRecords[0].documentId }, "P0002");
const linked = await rpc(dual.client, "executive_save_document", saveInput("daily_brief", { ...data.daily_brief, references: sourceRecords }));
await denied(own.client, "executive_save_document", saveInput("daily_brief", { ...data.daily_brief, references: sourceRecords }), "42501");
assert.equal((await resolve([{ ...sourceRecords[0], revision: 2 }])).references[0].state, "unavailable");
pass("permitted metadata is strictly projected; source bodies, cross-client records and wrong-domain IDs stay private");

await share([]);
assert.ok((await resolve(sourceRecords)).references.every(x => x.metadata === null));
assert.equal((await rpc(dual.client, "executive_get_document", { p_kind: "daily_brief", p_document_id: linked.document.id })).document.id, linked.document.id);
await denied(dual.client, "executive_save_document", { ...saveInput("daily_brief", linked.document.data), p_document_id: linked.document.id, p_expected_revision: 1 }, "42501");
await share(["writer.resource.library"]);
const grantIds = localSql(`select id from workspace.bundle_entitlements where workspace_id='${target}' and bundle_key='writer_editor' and revoked_at is null;`).split("\n").filter(Boolean);
assert.ok(grantIds.length);
for (const key of grantIds) assert.match(key, /^[0-9a-f-]{36}$/);
try {
  for (const entitlementId of grantIds) await rpc(operator.client, "revoke_bundle_entitlement", { target_entitlement_id: entitlementId, revocation_reason: "Synthetic Executive permission test" });
  assert.equal((await resolve([sourceRecords[0]])).references[0].metadata, null);
} finally {
  await rpc(operator.client, "issue_bundle_assignment", { target_workspace_id: target, target_bundle_key: "writer_editor", idempotency_key: "executive-restore-" + randomUUID(), target_expires_at: null });
  await share([]);
}
pass("sharing removal and source entitlement revocation close projections immediately without deleting the user's own brief");
console.log("Executive native RPC acceptance: " + groups + " groups. Real local auth/database; no HTTP app, MCP host, provider, scheduler or client-value proof.");
