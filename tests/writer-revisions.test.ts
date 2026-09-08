import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { decideProposalInput, importResourceInput, proposeRevisionInput, writingPatch } from "@/lib/writing/revision-contracts";
import { importWritingResource, proposeWritingRevision, decideWritingProposal } from "@/lib/writing/revisions-server";
import { writingMutation } from "@/lib/writing/mutation-http";
const auth = vi.hoisted(() => ({ authenticatedBundleClient: vi.fn() }));
vi.mock("@/lib/workspace/bundle-server", async (original) => ({ ...await original<object>(), authenticatedBundleClient: auth.authenticatedBundleClient }));
const id = "74000000-0000-4000-8000-000000000001";
describe("Writer approval contracts", () => {
  it.each([{workspace_id:id},{epistemic_state:"confirmed"},{publication_state:"published"},{title:null},{metadata:{theology:"confirmed"}},{topics:["x".repeat(121)]},{}])("rejects protected or invalid changes %j",(patch) => {
    expect(writingPatch.safeParse(patch).success).toBe(false);
  });
  it("accepts a bounded proposal with an explicit source basis",() => {
    expect(proposeRevisionInput.parse({ resourceId:id, requestId:id, baseRevision:1, patch:{audience:"Volunteers"},reason:"Clarify the reader",evidence:"User request and imported manuscript" }).patch).toEqual({audience:"Volunteers"});
    expect(proposeRevisionInput.safeParse({resourceId:id,requestId:id,baseRevision:1,patch:{title:"Title"},reason:"",evidence:""}).success).toBe(false);
  });
  it.each(["javascript:alert(1)","file:///private","https://user:password@example.com"])("rejects unsafe source URLs %s",(source_url) => {
    expect(importResourceInput.safeParse({ requestId:id,resource:{title:"Title",body_text:"Source",source_label:"User",source_url} }).success).toBe(false);
  });
  it("rejects tenant overrides and approval patch substitution",() => {
    expect(importResourceInput.safeParse({requestId:id,workspaceId:id,resource:{title:"Title",body_text:"Source",source_label:"User"}}).success).toBe(false);
    expect(decideProposalInput.safeParse({proposalId:id,expectedRevision:1,decision:"approve",patch:{title:"Swapped"}}).success).toBe(false);
  });
  it("maps only the immutable proposal identity and reviewed revision to approval",async () => {
    const rpc = vi.fn(async () => ({data:{proposalId:id,status:"approved",revision:2,replayed:false},error:null}));
    await decideWritingProposal({rpc} as never,{proposalId:id,expectedRevision:1,decision:"approve"});
    expect(rpc).toHaveBeenCalledWith("writer_decide_proposal",{proposal_id:id,expected_revision:1,decision:"approve"});
  });
  it.each([["42501",403],["40001",409],["22023",400],["P0002",404],["XX000",503]])("translates database boundary %s without leaking details",async(code,status) => {
    const rpc = vi.fn(async () => ({data:null,error:{code,message:"PRIVATE DATABASE DETAIL"}}));
    await expect(proposeWritingRevision({rpc} as never,{requestId:id,resourceId:id,baseRevision:1,patch:{title:"Title"},reason:"Reason",evidence:"Source"})).rejects.toMatchObject({status});
    await expect(importWritingResource({rpc} as never,{requestId:id,resource:{title:"Title",body_text:"Source",source_label:"User"}})).rejects.not.toThrow("PRIVATE DATABASE DETAIL");
  });
  it("bounds streamed JSON, rejects bad JSON and avoids calling a mutation on failures",async () => {
    auth.authenticatedBundleClient.mockResolvedValue({client:{}});
    const operation = vi.fn();
    for (const [body, status] of [["x",400],['{"x":"'+"x".repeat(650001)+'"}',413]] as const) {
      const response=await writingMutation(new Request("http://localhost/api/writing/import",{method:"POST",headers:{Authorization:"Bearer synthetic","Content-Type":"application/json"},body}),operation);
      expect(response.status).toBe(status); expect(response.headers.get("cache-control")).toContain("no-store");
    }
    expect(operation).not.toHaveBeenCalled();
  });
});
