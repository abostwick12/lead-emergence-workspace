import { describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
import {
  clearSourceBatchInput, commitSourceBatchInput, reviewSourceBatchInput, saveSourceBatchInput
} from "@/lib/writing/batch-contracts";
import {
  clearSourceBatch, commitSourceBatch, getSourceBatch, reviewSourceBatch, saveSourceBatch
} from "@/lib/writing/batch-server";

const itemId="20444444-4444-4444-8444-444444444444";
const requestId="20666666-6666-4666-8666-666666666666";
const item={itemId,extraction:{schemaVersion:"1.0",file:{name:"source.docx",format:"word_docx",mediaType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",byteSize:42,sha256:"a".repeat(64)},titleSuggestion:"Source",text:"A useful source",characterCount:15,wordCount:3,pageCount:null,warnings:["formatting_not_preserved","review_extracted_text"],originalRetained:false},title:"Source",sourceLabel:"Imported from source.docx",resourceType:"article",included:true} as const;

describe("Writer bulk library boundary",()=>{
  it("accepts only strict versioned staging and explicit confirmed commit inputs",()=>{
    expect(saveSourceBatchInput.parse({expectedVersion:0,requestId,items:[item]}).items[0].title).toBe("Source");
    expect(saveSourceBatchInput.safeParse({expectedVersion:0,requestId,workspaceId:requestId,items:[item]}).success).toBe(false);
    expect(clearSourceBatchInput.safeParse({expectedVersion:1}).success).toBe(true);
    expect(reviewSourceBatchInput.safeParse({expectedVersion:0}).success).toBe(false);
    expect(commitSourceBatchInput.safeParse({expectedVersion:1,requestId,reviewToken:"b".repeat(64),confirm:false}).success).toBe(false);
  });

  it("maps exact owner-derived RPC arguments and parses every portable receipt",async()=>{
    const now="2026-09-15T15:00:00Z";
    const snapshot={schemaVersion:"1.0",version:1,requestId,items:[item],savedAt:now};
    const review={schemaVersion:"1.0",version:1,reviewedAt:now,reviewToken:"b".repeat(64),items:[{itemId,candidates:[]}]};
    const commit={schemaVersion:"1.0",batchVersion:1,replayed:false,resources:[{itemId,resourceId:"20777777-7777-4777-8777-777777777777",title:"Source"}]};
    const rpc=vi.fn(async(name:string)=>({data:name==="writer_review_import_batch"?review:name==="writer_commit_import_batch"?commit:snapshot,error:null}));
    const client={rpc} as never;
    await expect(getSourceBatch(client)).resolves.toEqual(snapshot);
    await expect(saveSourceBatch(client,{expectedVersion:0,requestId,items:[item]})).resolves.toEqual(snapshot);
    await expect(clearSourceBatch(client,{expectedVersion:1})).resolves.toEqual(snapshot);
    await expect(reviewSourceBatch(client,{expectedVersion:1})).resolves.toEqual(review);
    await expect(commitSourceBatch(client,{expectedVersion:1,requestId,reviewToken:"b".repeat(64),confirm:true})).resolves.toEqual(commit);
    expect(rpc).toHaveBeenNthCalledWith(1,"writer_get_import_batch");
    expect(rpc).toHaveBeenNthCalledWith(2,"writer_save_import_batch",{expected_version:0,request_id:requestId,items:[item]});
    expect(rpc).toHaveBeenNthCalledWith(3,"writer_clear_import_batch",{expected_version:1});
    expect(rpc).toHaveBeenNthCalledWith(4,"writer_review_import_batch",{expected_version:1});
    expect(rpc).toHaveBeenNthCalledWith(5,"writer_commit_import_batch",{expected_version:1,request_id:requestId,review_token:"b".repeat(64),confirmed:true});
  });

  it.each([["42501",403],["40001",409],["22023",400],["XX000",503]])("translates private database error %s without disclosing it",async(code,status)=>{
    const client={rpc:vi.fn(async()=>({data:null,error:{code,message:"PRIVATE DATABASE DETAIL"}}))} as never;
    await expect(reviewSourceBatch(client,{expectedVersion:1})).rejects.toMatchObject({status});
    await expect(reviewSourceBatch(client,{expectedVersion:1})).rejects.not.toThrow("PRIVATE DATABASE DETAIL");
  });
});
