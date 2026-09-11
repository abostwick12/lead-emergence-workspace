import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
import {
  publicationEvidenceInput, publicationQueueItem, publicationQueueSaveInput
} from "@/lib/writing/publication-readiness";
import {
  getPublicationQueueItem, listPublicationQueue, recordPublicationLink, savePublicationQueue
} from "@/lib/writing/publication-queue-server";

const resourceId="21333333-3333-4333-8333-333333333333",queueId="21444444-4444-4444-8444-444444444444";
const requestId="21555555-5555-4555-8555-555555555555",destination="https://resources.example.com/item";
const confirmations={accuracyAndQuotesReviewed:true,voiceReviewed:true,rightsConfirmed:true};
const item={id:queueId,resourceId,title:"Fictional resource",resourceRevision:2,currentResourceRevision:2,version:3,
  stage:"ready_for_handoff",publicationState:"ready",destinationUrl:destination,note:"Fictional handoff",confirmations,pendingProposals:0,
  evidenceStatus:"checked",lastEvidence:{id:"21666666-6666-4666-8666-666666666666",resourceRevision:2,targetUrl:destination,result:"working",finalUrl:null,note:"Observed manually",checkedAt:"2026-09-15T12:00:00Z"},
  blockers:[],readyForHandoff:true,createdAt:"2026-09-15T11:00:00Z",updatedAt:"2026-09-15T12:00:00Z"} as const;

describe("Writer publication readiness boundary",()=>{
  it("requires strict direct confirmations and public HTTPS destinations",()=>{
    const save={resourceId,expectedResourceRevision:2,expectedVersion:2,requestId,destinationUrl:destination,note:"Fictional handoff",stage:"ready_for_handoff",confirmations,confirmQueueChange:true} as const;
    expect(publicationQueueSaveInput.parse(save).destinationUrl).toBe(destination);
    expect(publicationQueueSaveInput.safeParse({...save,workspaceId:resourceId}).success).toBe(false);
    expect(publicationQueueSaveInput.safeParse({...save,destinationUrl:"https://127.0.0.1/private"}).success).toBe(false);
    expect(publicationQueueSaveInput.safeParse({...save,confirmQueueChange:false}).success).toBe(false);
    expect(publicationEvidenceInput.safeParse({queueId,expectedVersion:3,requestId,result:"working",finalUrl:null,note:"",confirmObservation:false}).success).toBe(false);
  });

  it("maps only exact owner-derived RPC fields and validates every response",async()=>{
    const list={schemaVersion:"1.0",retrievedAt:"2026-09-15T12:00:00Z",total:1,counts:{queued:0,blocked:0,readyForHandoff:1,handedOff:0},items:[item]};
    const receipt={item,replayed:false};
    const rpc=vi.fn(async(name:string)=>({data:name==="writer_list_publication_queue"?list:name==="writer_get_publication_queue_item"?item:receipt,error:null}));
    const client={rpc} as never;
    await expect(listPublicationQueue(client,{stage:"ready_for_handoff",offset:0,limit:25})).resolves.toEqual(list);
    await expect(getPublicationQueueItem(client,resourceId)).resolves.toEqual(item);
    await expect(savePublicationQueue(client,{resourceId,expectedResourceRevision:2,expectedVersion:2,requestId,destinationUrl:destination,note:"Fictional handoff",stage:"ready_for_handoff",confirmations,confirmQueueChange:true})).resolves.toEqual(receipt);
    await expect(recordPublicationLink(client,{queueId,expectedVersion:3,requestId,result:"working",finalUrl:null,note:"Observed manually",confirmObservation:true})).resolves.toEqual(receipt);
    expect(rpc).toHaveBeenNthCalledWith(1,"writer_list_publication_queue",{stage_filter:"ready_for_handoff",page_offset:0,page_size:25});
    expect(rpc).toHaveBeenNthCalledWith(2,"writer_get_publication_queue_item",{resource_id:resourceId});
    expect(rpc).toHaveBeenNthCalledWith(3,"writer_save_publication_queue",{resource_id:resourceId,expected_resource_revision:2,expected_version:2,request_id:requestId,destination_url:destination,queue_note:"Fictional handoff",queue_stage:"ready_for_handoff",review_confirmations:confirmations,confirm_queue_change:true});
    expect(rpc).toHaveBeenNthCalledWith(4,"writer_record_publication_link",{queue_id:queueId,expected_version:3,request_id:requestId,observed_result:"working",final_url:null,evidence_note:"Observed manually",confirm_observation:true});
  });

  it.each([["42501",403],["40001",409],["22023",400],["P0002",404],["XX000",503]])("translates database boundary %s without private details",async(code,status)=>{
    const client={rpc:vi.fn(async()=>({data:null,error:{code,message:"PRIVATE DATABASE DETAIL"}}))} as never;
    await expect(listPublicationQueue(client,{})).rejects.toMatchObject({status});
    await expect(listPublicationQueue(client,{})).rejects.not.toThrow("PRIVATE DATABASE DETAIL");
  });

  it("keeps the interface and migration honest about human observation and publication",()=>{
    const ui=readFileSync("components/writing/writing-publication-queue.tsx","utf8"),migration=readFileSync("supabase/migrations/20260915160000_writer_publication_readiness.sql","utf8");
    expect(publicationQueueItem.parse(item).readyForHandoff).toBe(true);
    expect(ui).toContain("Workspace does not fetch this URL");expect(ui).toContain("Handoff recorded—not published.");
    expect(ui).not.toContain("fetch(");expect(migration).toContain("This workflow never fetches a destination and never publishes externally.");
    expect(migration).not.toMatch(/http_get|http_post|net\.http|pg_net/i);
  });
});
