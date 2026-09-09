import "server-only";
import {z} from "zod";
import type {SupabaseClient} from "@supabase/supabase-js";
import {BundleApiError} from "@/lib/workspace/bundle-server";
import {nonprofitKind,nonprofitResult,nonprofitSave,nonprofitSearch,nonprofitSearchResult,nonprofitProposalInput,nonprofitProposal,nonprofitDecision,nonprofitDecisionResult,nonprofitHistory,nonprofitProposalsResult,nonprofitAttention} from "./contracts";
type Client=SupabaseClient<any,any,any,any,any>;
export async function nonprofitRpc<T>(client:Client,name:string,params:Record<string,unknown>,schema:z.ZodType<T>):Promise<T>{
 const {data,error}=await client.rpc(name,params);
 if(error){
  const status=error.code==="42501"?403:error.code==="P0002"?404:error.code==="40001"?409:["22023","22P02"].includes(error.code)?400:503;
  throw new BundleApiError(status===403?"Your Nonprofit access does not allow this action.":status===404?"This founder record is unavailable.":status===409?"This record or proposal changed. Your work was not applied. Compare the latest saved revision before retrying.":status===400?"Check the administrative record, dates, dependencies and confirmation.":"Nonprofit is temporarily unavailable. You can safely retry.",status);
 }
 const result=schema.safeParse(data);
 if(!result.success)throw new BundleApiError("We could not verify the Nonprofit response. Please retry.",503);
 return result.data;
}
export async function getDocument(client:Client,rawKind:unknown,rawId:unknown){
 return nonprofitRpc(client,"nonprofit_get_document",{p_kind:nonprofitKind.parse(rawKind),p_document_id:z.string().uuid().parse(rawId)},nonprofitResult);
}
export async function searchDocuments(client:Client,rawKind:unknown,raw:unknown){
 const input=nonprofitSearch.parse(raw);
 return nonprofitRpc(client,"nonprofit_search_documents",{p_kind:nonprofitKind.parse(rawKind),p_search:input.search,p_offset:input.offset,p_limit:input.limit},nonprofitSearchResult);
}
export async function saveDocument(client:Client,raw:unknown,expectedKind:string){
 const input=nonprofitSave.parse(raw);
 if(input.kind!==expectedKind)throw new BundleApiError("Record type does not match this workspace.",400);
 return nonprofitRpc(client,"nonprofit_save_document",{p_kind:input.kind,p_document_id:input.documentId,p_expected_revision:input.expectedRevision,p_request_id:input.requestId,p_data:input.data,p_confirm_administrative:input.confirmAdministrative},nonprofitResult);
}
export async function proposeDocument(client:Client,raw:unknown,expectedKind:string){
 const input=nonprofitProposalInput.parse(raw);
 if(input.kind!==expectedKind)throw new BundleApiError("Record type does not match this proposal.",400);
 return nonprofitRpc(client,"nonprofit_propose_document",{p_kind:input.kind,p_document_id:input.documentId,p_expected_revision:input.expectedRevision,p_request_id:input.requestId,p_data:input.data,p_reason:input.reason,p_evidence:input.evidence,p_scope:input.scope},nonprofitProposal);
}
export async function listProposals(client:Client,rawKind:unknown,offset:unknown,status:unknown="pending"){
 return nonprofitRpc(client,"nonprofit_list_proposals",{p_kind:nonprofitKind.parse(rawKind),p_offset:z.number().int().min(0).max(10000).parse(offset),p_status:z.enum(["pending","approved","rejected"]).parse(status)},nonprofitProposalsResult);
}
export async function decideProposal(client:Client,raw:unknown){
 const input=nonprofitDecision.parse(raw);
 return nonprofitRpc(client,"nonprofit_decide_proposal",{p_proposal_id:input.proposalId,p_expected_revision:input.expectedRevision,p_decision:input.decision,p_confirm_administrative:input.confirmAdministrative},nonprofitDecisionResult);
}
export async function documentHistory(client:Client,rawKind:unknown,rawId:unknown){
 return nonprofitRpc(client,"nonprofit_document_history",{p_kind:nonprofitKind.parse(rawKind),p_document_id:z.string().uuid().parse(rawId)},nonprofitHistory);
}
export async function nextMoves(client:Client){return nonprofitRpc(client,"nonprofit_next_moves",{},nonprofitAttention);}
