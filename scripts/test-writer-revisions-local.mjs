import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { appUrl, localConfiguration, localSql, fixtureSession } from "./bundle-local-runtime.mjs";
const config = await localConfiguration();
const fixtures = JSON.parse(await readFile(".bundle-local/fixtures.json","utf8"));
const writer = await fixtureSession(config,fixtures.writer), reader = await fixtureSession(config,fixtures.reader), other = await fixtureSession(config,fixtures.other);
const created = [];
let count = 0;
function pass(name) { count++; console.log("PASS " + name); }
async function rpc(name,args,code) {
  const result = await writer.client.rpc(name,args);
  if (code) assert.equal(result.error?.code,code,JSON.stringify(result.error));
  else assert.equal(result.error,null,JSON.stringify(result.error));
  return result.data;
}
async function web(path,input,token=writer.token) {
  const response = await fetch(appUrl+path,{ method:"POST", headers:{ Authorization:"Bearer "+token,"Content-Type":"application/json" },body:JSON.stringify(input) });
  return { status:response.status, body:await response.json(), headers:response.headers };
}
const input = { title:"Synthetic P3 manuscript "+randomUUID(), body_text:"A fictional source about making space to listen.\nKeep this original.", source_label:"Synthetic P3 acceptance", author:"Fictional author", metadata:{ themes:["Attention"], website_summary:"Original summary" } };
try {
  const requestId = randomUUID();
  const imported = await web("/api/writing/import",{ requestId,resource:input });
  assert.equal(imported.status,200,JSON.stringify(imported.body)); created.push(imported.body.resourceId);
  const id = imported.body.resourceId;
  assert.match(imported.headers.get("cache-control"),/no-store/);
  const retry = await web("/api/writing/import",{ requestId,resource:input });
  assert.equal(retry.status,200); assert.equal(retry.body.resourceId,id); assert.equal(retry.body.replayed,true);
  assert.equal((await web("/api/writing/import",{ requestId,resource:{...input,title:"different"} })).status,409);
  pass("web import preserves original, is private, and safely replays identical requests");
  const original = await rpc("writer_get_resource",{ resource_id:id });
  assert.equal(original.resource.revision,1); assert.equal(original.resource.epistemic_state,"user_stated"); assert.equal(original.resource.publication_state,"draft");
  assert.equal(original.resource.body_text,input.body_text);
  assert.equal((await reader.client.rpc("writer_import_resource",{request_id:randomUUID(),resource_input:input})).error?.code,"42501");
  assert.equal((await other.client.rpc("writer_get_revision_history",{resource_id:id})).error?.code,"P0002");
  assert.equal((await web("/api/writing/import",{requestId:randomUUID(),resource:input},reader.token)).status,403);
  pass("unentitled import and foreign resource history fail closed");
  for (const patch of [{workspace_id:fixtures.other.workspaceId},{epistemic_state:"confirmed"},{publication_state:"published"},{title:null},{topics:["x".repeat(121)]},{metadata:{belief:"confirmed"}},{metadata:{themes:null}},{body_text:"x".repeat(100001)}]) {
    await rpc("writer_propose_revision",{resource_id:id,request_id:randomUUID(),base_revision:1,proposed_patch:patch,proposal_reason:"Synthetic reason",source_evidence:"Synthetic source"}, "22023");
  }
  await rpc("writer_propose_revision",{resource_id:id,request_id:randomUUID(),base_revision:1,proposed_patch:{metadata:{related_resource_ids:[fixtures.foreignResourceId]}},proposal_reason:"Synthetic reason",source_evidence:"Synthetic source"}, "P0002");
  await rpc("writer_import_resource",{request_id:randomUUID(),resource_input:{...input,source_url:"https://user:pass@example.invalid/path"}},"22023");
  await rpc("writer_import_resource",{request_id:randomUUID(),resource_input:{...input,source_date:"2026-02-30"}},"22023");
  await rpc("writer_import_resource",{request_id:randomUUID(),resource_input:{...input,publication_state:"ready"}},"22023");
  await rpc("writer_import_resource",{request_id:randomUUID(),resource_input:{...input,metadata:{related_resource_ids:[fixtures.foreignResourceId]}}},"P0002");
  pass("direct RPC rejects protected fields, bad types, bounds, foreign relations, false publication, and invalid source details");
  const proposalInput = { resourceId:id,requestId:randomUUID(),baseRevision:1,patch:{ audience:"Community volunteers",body_text:"A proposed fictional revision.",metadata:{...input.metadata,seo_description:"A fictional resource on listening."} },reason:"Make the audience and invitation clearer.",evidence:"The imported fictional manuscript discusses listening; audience is a suggestion." };
  const saved = await web("/api/writing/proposals",proposalInput);
  assert.equal(saved.status,200,JSON.stringify(saved.body));
  const proposalId=saved.body.proposalId;
  assert.equal((await rpc("writer_get_resource",{resource_id:id})).resource.body_text,input.body_text);
  assert.equal((await web("/api/writing/proposals",proposalInput)).body.proposalId,proposalId);
  assert.equal((await web("/api/writing/proposals",{...proposalInput,reason:"Changed content"})).status,409);
  pass("saved proposals do not mutate canonical content; identical retry returns the same proposal");
  const stale=await rpc("writer_propose_revision",{resource_id:id,request_id:randomUUID(),base_revision:1,proposed_patch:{audience:"A competing suggestion"},proposal_reason:"Competing suggestion",source_evidence:"Synthetic source"});
  assert.equal((await other.client.rpc("writer_decide_proposal",{proposal_id:proposalId,expected_revision:1,decision:"approve"})).error?.code,"P0002");
  await rpc("writer_decide_proposal",{proposal_id:proposalId,expected_revision:2,decision:"approve"},"40001");
  await rpc("writer_decide_proposal",{proposal_id:proposalId,expected_revision:1,decision:null},"22023");
  const approved=await web("/api/writing/proposals/decision",{proposalId,expectedRevision:1,decision:"approve"});
  assert.equal(approved.status,200,JSON.stringify(approved.body)); assert.equal(approved.body.revision,2);
  const revised=await rpc("writer_get_resource",{resource_id:id});
  assert.equal(revised.resource.body_text,proposalInput.patch.body_text);
  assert.equal(revised.resource.metadata.website_summary,input.metadata.website_summary);
  assert.equal(revised.resource.epistemic_state,"user_stated");
  const history=await rpc("writer_get_revision_history",{resource_id:id});
  assert.equal(history.revisions.length,2); assert.equal(history.revisions[1].snapshot.body_text,input.body_text);
  assert.equal(history.revisions[0].origin,"user_approved_proposal");
  pass("explicit native approval saves revision 2 with an immutable original and does not certify suggested facts");
  const replay=await rpc("writer_decide_proposal",{proposal_id:proposalId,expected_revision:1,decision:"approve"});
  assert.equal(replay.replayed,true);
  assert.equal((await rpc("writer_get_revision_history",{resource_id:id})).revisions.length,2);
  await rpc("writer_decide_proposal",{proposal_id:proposalId,expected_revision:1,decision:"reject"},"40001");
  await rpc("writer_decide_proposal",{proposal_id:stale.proposalId,expected_revision:1,decision:"approve"},"40001");
  await rpc("writer_decide_proposal",{proposal_id:stale.proposalId,expected_revision:1,decision:"reject"});
  pass("approval replay is idempotent; conflicting decisions and stale overwrites are denied; stale proposals can be rejected");
  const competitors = await Promise.all(["first","second"].map((label) => rpc("writer_propose_revision",{
    resource_id:id,request_id:randomUUID(),base_revision:2,proposed_patch:{audience:"Concurrent "+label},proposal_reason:"Concurrent "+label,source_evidence:"Synthetic concurrency test"
  })));
  const decisions = await Promise.all(competitors.map((proposal) => web("/api/writing/proposals/decision",{
    proposalId:proposal.proposalId,expectedRevision:2,decision:"approve"
  })));
  assert.deepEqual(decisions.map((result)=>result.status).sort(),[200,409]);
  assert.equal((await rpc("writer_get_resource",{resource_id:id})).resource.revision,3);
  pass("simultaneous approvals serialize; exactly one wins and the other cannot overwrite it");
  for (let base=3;base<14;base++) {
    const proposal=await rpc("writer_propose_revision",{resource_id:id,request_id:randomUUID(),base_revision:base,proposed_patch:{audience:"Synthetic history "+base},proposal_reason:"Synthetic history retention",source_evidence:"Local retention test"});
    await rpc("writer_decide_proposal",{proposal_id:proposal.proposalId,expected_revision:base,decision:"approve"});
  }
  const retained=await rpc("writer_get_revision_history",{resource_id:id});
  assert.equal(retained.revisions.length,10); assert.equal(retained.revisions[0].revision,14);
  assert.equal(retained.revisions[9].revision,1); assert.equal(retained.revisions[9].snapshot.body_text,input.body_text);
  pass("bounded history always retains an accessible original after more than ten revisions");
  assert.equal((await web("/api/writing/proposals",{...proposalInput,requestId:randomUUID(),workspaceId:fixtures.other.workspaceId})).status,400);
  assert.equal((await web("/api/writing/proposals/decision",{proposalId,expectedRevision:1,decision:"approve",patch:{title:"swapped"}})).status,400);
  const oversized=await fetch(appUrl+"/api/writing/import",{method:"POST",headers:{Authorization:"Bearer "+writer.token,"Content-Type":"application/json"},body:'{"text":"'+ "x".repeat(650001)+'"}'});
  assert.equal(oversized.status,413);
  pass("web boundary rejects tenant/patch substitution and oversized request bodies");
  const privileges=localSql("select has_table_privilege('authenticated','workspace_private.writing_proposals','update'),has_table_privilege('authenticated','workspace_private.writing_revisions','delete'),has_table_privilege('authenticated','workspace_private.writing_import_requests','select'),has_function_privilege('anon','workspace.writer_decide_proposal(uuid,integer,text)','execute');");
  assert.equal(privileges,"f|f|f|f");
  pass("proposal/revision/import tables and anonymous approval have no direct privileges");
  console.log("Writer revision acceptance: "+count+" groups passed.");
} finally {
  // Delete only the exact synthetic resources created by this run, on the
  // explicitly guarded isolated test database. No real/client data is touched.
  for (const id of created) {
    assert.match(id,/^[0-9a-f-]{36}$/);
    localSql("delete from workspace_private.writing_resources where id='"+id+"' and source_label='Synthetic P3 acceptance';");
  }
}
