import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {draftValues,saveDraftInput,clearDraftInput} from "@/lib/writing/draft-contracts";
import {connectionInput,writingConnections} from "@/lib/writing/discovery-contracts";
import {patchFromWorkingDraft,resourceEditorValues} from "@/lib/writing/draft-editing";
import {getWorkingDraft,saveWorkingDraft,clearWorkingDraft,findWritingConnections} from "@/lib/writing/library-server";
import type {WritingResource} from "@/lib/writing/contracts";
const id="74000000-0000-4000-8000-000000000001";
const resource:WritingResource={id,title:"Original",author:null,resource_type:"article",audience:null,topics:["Attention"],abstract:null,body_text:"Original text.",
 source_url:null,source_label:"Synthetic source",source_date:null,retrieved_at:"2026-09-08T00:00:00Z",epistemic_state:"user_stated",publication_state:"draft",updated_at:"2026-09-08T00:00:00Z",revision:1,
 metadata:{themes:["Listening"],scripture_references:["Luke 10:25-37"],source_file:"synthetic.md"}};
describe("Private Writer drafts and evidence-led discovery",()=>{
 it("preserves incomplete input without granting permission to submit it",()=>{
  expect(draftValues.parse({title:"",reason:"",source_url:"unfinished",publication_state:"unfinished"}).title).toBe("");
  expect(()=>patchFromWorkingDraft(resource,{...resourceEditorValues(resource),title:""})).toThrow();
 });
 it.each([{workspaceId:id},{title:4},{body_text:"x".repeat(100001)},{source_file:"x".repeat(501)}])("rejects draft overrides and oversized or mistyped fields %j",(value)=>{
  expect(draftValues.safeParse(value).success).toBe(false);
 });
 it("does not generate a proposal for unchanged content",()=>expect(()=>patchFromWorkingDraft(resource,resourceEditorValues(resource))).toThrow());
 it("edits only changed fields while preserving metadata not shown in the form",()=>{
  expect(patchFromWorkingDraft(resource,{...resourceEditorValues(resource),website_summary:"Summary",author:"Example"})).toEqual({author:"Example",metadata:{...resource.metadata,website_summary:"Summary",seo_description:""}});
 });
 it("normalizes comma-separated topics and supports clearing optional fields",()=>{
  const current={...resource,author:"Example"};
  expect(patchFromWorkingDraft(current,{...resourceEditorValues(current),author:"",topics:" Care, Listening , "})).toEqual({author:null,topics:["Care","Listening"]});
 });
 it.each([0,21,1.5])("bounds discovery limit %s",(limit)=>expect(connectionInput.safeParse({resourceId:id,limit}).success).toBe(false));
 it("never accepts tenant substitution or a discard payload",()=>{
  const input={resourceId:id,expectedVersion:0,baseRevision:1,requestId:id,values:{}};
  expect(saveDraftInput.safeParse({...input,tenantId:id}).success).toBe(false);
  expect(clearDraftInput.safeParse({resourceId:id,expectedVersion:1,values:{}}).success).toBe(false);
  expect(connectionInput.safeParse({resourceId:id,workspaceId:id}).success).toBe(false);
 });
 it("maps the exact draft identity, version and request ID to the database",async()=>{
  const data={version:1,baseRevision:1,requestId:id,values:{title:""},savedAt:"2026-09-08"};
  const rpc=vi.fn(async()=>({data,error:null}));
  await saveWorkingDraft({rpc} as never,{resourceId:id,expectedVersion:0,baseRevision:1,requestId:id,values:{title:""}});
  expect(rpc).toHaveBeenCalledWith("writer_save_working_draft",{resource_id:id,expected_version:0,base_revision:1,request_id:id,draft_values:{title:""}});
  await clearWorkingDraft({rpc} as never,{resourceId:id,expectedVersion:1});
  expect(rpc).toHaveBeenLastCalledWith("writer_clear_working_draft",{resource_id:id,expected_version:1});
 });
 it.each([["40001",409],["42501",403],["P0002",404],["22023",400],["XX000",503]])("maps %s without leaking database detail",async(code,status)=>{
  const rpc=vi.fn(async()=>({data:null,error:{code,message:"PRIVATE DATABASE DETAIL"}}));
  await expect(getWorkingDraft({rpc} as never,id)).rejects.toMatchObject({status});
  await expect(findWritingConnections({rpc} as never,{resourceId:id})).rejects.not.toThrow("PRIVATE DATABASE DETAIL");
 });
 it("rejects malformed outputs and invented semantic matching signals",()=>{
  expect(writingConnections.safeParse({resourceId:id,baseRevision:1,retrievedAt:"now",matchingCount:1,method:"Recorded comparison",candidates:[{id,title:"Candidate",author:null,abstract:null,source_label:"Source",source_url:null,revision:1,updated_at:"now",duplicate_signals:["same_meaning"],shared_topics:[],shared_scripture:[]}]}).success).toBe(false);
 });
});
