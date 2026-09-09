import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {profileLabels,profileResult,profileSaveInput,writingProfile} from "@/lib/writing/profile-contracts";
import {getWritingProfile,saveWritingProfile} from "@/lib/writing/profile-server";
import {publicationInput,preparePublication,publicationText} from "@/lib/writing/publication";
import {getPublicationPacket} from "@/lib/writing/publication-server";
import type {WritingResource} from "@/lib/writing/contracts";
const id="74000000-0000-4000-8000-000000000001";
const resource:WritingResource={id,title:"Synthetic handoff",author:"Example",resource_type:"article",audience:"Volunteers",topics:["Care"],abstract:"Internal abstract",body_text:"Approved source text.",
 source_url:"https://example.com/source",source_label:"User source",source_date:"2026-09-01",retrieved_at:"2026-09-08T00:00:00Z",epistemic_state:"user_stated",publication_state:"ready",updated_at:"2026-09-08T00:00:00Z",revision:2,
 metadata:{website_summary:"Website copy",seo_description:"Search description",themes:["Hospitality"],scripture_references:["Luke 10"],keywords:["Care"],series:"Welcoming",source_file:"PRIVATE_SOURCE_FILE",canonical_file:"PRIVATE_CANONICAL_FILE",provider_record_id:"PRIVATE_PROVIDER_ID"}};
describe("Confirmed writing preferences and publication handoff",()=>{
 it("accepts only bounded client-writing fields, without beliefs or inferred status",()=>{
  expect(writingProfile.parse({voice_notes:"Keep the direct voice",topics:["Attention"]})).toEqual({voice_notes:"Keep the direct voice",topics:["Attention"]});
  for(const input of [{theology:"Inherited"},{epistemicState:"confirmed"},{workspaceId:id},{voice_notes:"x".repeat(4001)},{topics:Array(101).fill("Care")},{topics:["Care","CARE"]},{themes:[4]}])
   expect(writingProfile.safeParse(input).success).toBe(false);
 });
 it("requires explicit confirmation and an exact current revision",()=>{
  const input={expectedRevision:0,requestId:id,profile:{voice_notes:"Direct"},confirmPreferences:true};
  expect(profileSaveInput.safeParse(input).success).toBe(true);
  for(const bad of [{...input,confirmPreferences:false},{...input,expectedRevision:-1},{...input,tenantId:id}])expect(profileSaveInput.safeParse(bad).success).toBe(false);
 });
 it("does not accept contradictory confirmation states",()=>{
  expect(profileResult.safeParse({revision:0,profile:null,epistemicState:"unset",confirmedAt:null}).success).toBe(true);
  expect(profileResult.safeParse({revision:0,profile:{},epistemicState:"confirmed",confirmedAt:null}).success).toBe(false);
  expect(profileResult.safeParse({revision:1,profile:{},epistemicState:"unset",confirmedAt:"2026-09-08T00:00:00Z"}).success).toBe(false);
 });
 it("parses line-based labels without splitting commas inside a label",()=>expect(profileLabels(" Faith, hope\nCare\nCARE\n ")).toEqual(["Faith, hope","CARE"]));
 it("passes confirmation and identity to the exact narrow RPC",async()=>{
  const data={revision:1,profile:{voice_notes:"Direct"},epistemicState:"confirmed",confirmedAt:"2026-09-08T00:00:00Z"};
  const rpc=vi.fn(async()=>({data,error:null}));
  await saveWritingProfile({rpc} as never,{expectedRevision:0,requestId:id,profile:data.profile,confirmPreferences:true});
  expect(rpc).toHaveBeenCalledWith("writer_save_profile",{expected_revision:0,request_id:id,profile_input:data.profile,confirm_preferences:true});
 });
 it.each([["42501",403],["40001",409],["22023",400],["P0002",404],["XX000",503]])("maps %s without leaking internal detail",async(code,status)=>{
  const rpc=vi.fn(async()=>({data:null,error:{code,message:"PRIVATE_DETAIL"}}));
  await expect(getWritingProfile({rpc} as never)).rejects.toMatchObject({status});
  await expect(getPublicationPacket({rpc} as never,{resourceId:id,expectedRevision:2})).rejects.not.toThrow("PRIVATE_DETAIL");
 });
 it("exports useful canonical copy and provenance but never internal identifiers",()=>{
  const p=preparePublication({resource,preparedAt:"2026-09-08T00:00:00Z",pendingProposals:2});
  expect(p.content.bodyText).toBe(resource.body_text);expect(p.content.summary).toBe("Website copy");
  expect(p.source.evidenceStatus).toBe("user_stated");expect(p.revision).toBe(2);
  expect(p.checklist.find(c=>c.id==="proposals")?.status).toBe("needs_attention");
  for(const privateValue of ["PRIVATE_SOURCE_FILE","PRIVATE_CANONICAL_FILE","PRIVATE_PROVIDER_ID","Internal abstract"])expect(JSON.stringify(p)+publicationText(p)).not.toContain(privateValue);
  expect(publicationText(p)).toContain("Human review and separate publication authorization are required");
  expect(publicationText(p)).toContain("Intended reader: Volunteers");
  expect(publicationText(p)).toContain("Source date: 2026-09-01");
  expect(publicationText(p)).toContain("Pending proposals excluded: 2");
 });
 it("never treats complete metadata or a ready state as human verification",()=>{
  const p=preparePublication({resource,preparedAt:"2026-09-08T00:00:00Z",pendingProposals:0});
  expect(p.checklist.filter(c=>c.status==="human_review").map(c=>c.id)).toEqual(["accuracy","voice","rights","links","approval"]);
  expect(p.publicationDecision).toContain("not published");
 });
 it("retains original text literally instead of executing or silently rewriting it",()=>{
  const body='<script>alert("untrusted")</script>\nOriginal literal text.';
  expect(preparePublication({resource:{...resource,body_text:body},preparedAt:"now",pendingProposals:0}).content.bodyText).toBe(body);
 });
 it("warns on missing copy, stale source and archived resources",()=>{
  const p=preparePublication({resource:{...resource,body_text:"",author:null,audience:null,topics:[],metadata:{},publication_state:"archived",epistemic_state:"stale"},preparedAt:"now",pendingProposals:0});
  expect(p.checklist.filter(c=>c.status==="needs_attention").map(c=>c.id)).toEqual(["body","author","audience","summary","seo","topics","archived","source_status"]);
 });
 it("does not export unsafe source URLs as links",()=>{
  const p=preparePublication({resource:{...resource,source_url:"javascript:alert(1)"},preparedAt:"now",pendingProposals:0});
  expect(p.source.url).toBeNull();
 });
 it("rejects export revision and tenant substitution",()=>{
  for(const value of [{resourceId:id,expectedRevision:0},{resourceId:id,expectedRevision:2,workspaceId:id}])expect(publicationInput.safeParse(value).success).toBe(false);
 });
});
