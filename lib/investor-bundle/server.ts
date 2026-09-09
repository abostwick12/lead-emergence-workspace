import "server-only";
import {z} from "zod";
import type {SupabaseClient} from "@supabase/supabase-js";
import {BundleApiError} from "@/lib/workspace/bundle-server";
import {investorKind,investorResult,investorSave,investorSearch,investorSearchResult,investorProposalInput,investorProposal,investorDecision,investorDecisionResult,investorHistory,investorProposalsResult,investorAttention} from "./contracts";
type Client=SupabaseClient<any,any,any,any,any>;
const presentDocument=investorResult.refine(result=>result.document!==null,"Expected a saved research record.");
export async function investorRpc<T>(client:Client,name:string,params:Record<string,unknown>,schema:z.ZodType<T>):Promise<T>{
 const {data,error}=await client.rpc(name,params);
 if(error){
  const status=error.code==="54000"?429:error.code==="42501"?403:error.code==="P0002"?404:error.code==="40001"?409:["22023","22P02"].includes(error.code)?400:503;
  throw new BundleApiError(status===429?"Public lookup is temporarily rate-limited. Wait up to a minute before trying again; no research was changed.":status===403?"Your Investor access does not allow this action.":status===404?"This research record is unavailable.":status===409?"This record or proposal changed. Your work was not applied. Compare the latest saved revision before retrying.":status===400?"Check the public-research record, dates, source references, scenario assumptions and confirmation.":"Investor is temporarily unavailable. You can safely retry.",status);
 }
 const result=schema.safeParse(data);
 if(!result.success)throw new BundleApiError("We could not verify the Investor response. Please retry.",503);
 return result.data;
}
export async function getDocument(client:Client,rawKind:unknown,rawId:unknown){
 return investorRpc(client,"investor_get_document",{p_kind:investorKind.parse(rawKind),p_document_id:z.string().uuid().parse(rawId)},presentDocument);
}
export async function searchDocuments(client:Client,rawKind:unknown,raw:unknown){
 const input=investorSearch.parse(raw);
 return investorRpc(client,"investor_search_documents",{p_kind:investorKind.parse(rawKind),p_search:input.search,p_offset:input.offset,p_limit:input.limit},investorSearchResult);
}
export async function saveDocument(client:Client,raw:unknown,expectedKind:string){
 const input=investorSave.parse(raw);
 if(input.kind!==expectedKind)throw new BundleApiError("Record type does not match this workspace.",400);
 return investorRpc(client,"investor_save_document",{p_kind:input.kind,p_document_id:input.documentId,p_expected_revision:input.expectedRevision,p_request_id:input.requestId,p_data:input.data,p_confirm_research_only:input.confirmResearchOnly},presentDocument);
}
export async function proposeDocument(client:Client,raw:unknown,expectedKind:string){
 const input=investorProposalInput.parse(raw);
 if(input.kind!==expectedKind)throw new BundleApiError("Record type does not match this proposal.",400);
 return investorRpc(client,"investor_propose_document",{p_kind:input.kind,p_document_id:input.documentId,p_expected_revision:input.expectedRevision,p_request_id:input.requestId,p_data:input.data,p_reason:input.reason,p_evidence:input.evidence,p_scope:input.scope},investorProposal);
}
export async function listProposals(client:Client,rawKind:unknown,offset:unknown,status:unknown="pending"){
 return investorRpc(client,"investor_list_proposals",{p_kind:investorKind.parse(rawKind),p_offset:z.number().int().min(0).max(10000).parse(offset),p_status:z.enum(["pending","approved","rejected"]).parse(status)},investorProposalsResult);
}
export async function decideProposal(client:Client,raw:unknown){
 const input=investorDecision.parse(raw);
 return investorRpc(client,"investor_decide_proposal",{p_proposal_id:input.proposalId,p_expected_revision:input.expectedRevision,p_decision:input.decision,p_confirm_research_only:input.confirmResearchOnly},investorDecisionResult);
}
export async function documentHistory(client:Client,rawKind:unknown,rawId:unknown){
 return investorRpc(client,"investor_document_history",{p_kind:investorKind.parse(rawKind),p_document_id:z.string().uuid().parse(rawId)},investorHistory);
}
export async function nextMoves(client:Client){return investorRpc(client,"investor_next_moves",{},investorAttention);}
