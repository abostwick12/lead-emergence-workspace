import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BundleApiError } from "@/lib/workspace/bundle-server";
import { ministryDocumentKind, documentResult, documentSave, documentSearch, searchResult, researchProposalInput, researchProposal, decideResearch, historyResult } from "./contracts";
type Client = SupabaseClient<any, any, any, any, any>;
export async function ministryRpc<T>(client: Client, name: string, params: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const {data,error} = await client.rpc(name,params);
  if(error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : error.code === "40001" ? 409 : ["22023","22P02"].includes(error.code) ? 400 : 503;
    const message = status===403 ? "Your Ministry access does not allow this action." : status===404 ? "This Ministry record is unavailable." : status===409 ? "This record changed. Your work was not applied. Compare the latest saved revision before retrying." : status===400 ? "Check the record, sources, dates, and confirmation." : "Ministry is temporarily unavailable. You can safely retry.";
    throw new BundleApiError(message,status);
  }
  const parsed=schema.safeParse(data);
  if(!parsed.success) throw new BundleApiError("We could not verify the Ministry response. Please retry.",503);
  return parsed.data;
}
export async function getDocument(client:Client, rawKind:unknown, rawId:unknown=null) {
  const kind=ministryDocumentKind.parse(rawKind), id=z.string().uuid().nullable().parse(rawId);
  return ministryRpc(client,"ministry_get_document",{p_kind:kind,p_document_id:id},documentResult);
}
export async function saveDocument(client:Client,raw:unknown,expectedKind?:string) {
  const input=documentSave.parse(raw);
  if(expectedKind && input.kind!==expectedKind) throw new BundleApiError("Record type does not match this workspace.",400);
  return ministryRpc(client,"ministry_save_document",{p_kind:input.kind,p_document_id:input.documentId,p_expected_revision:input.expectedRevision,p_request_id:input.requestId,p_data:input.data,p_confirm_profile:input.confirmProfile},documentResult);
}
export async function searchDocuments(client:Client,rawKind:unknown,raw:unknown) {
  const kind=z.enum(["research","archive"]).parse(rawKind), input=documentSearch.parse(raw);
  return ministryRpc(client,"ministry_search_documents",{p_kind:kind,p_search:input.search,p_status:input.status??null,p_offset:input.offset,p_limit:input.limit},searchResult);
}
export async function proposeResearch(client:Client,raw:unknown) {
  const input=researchProposalInput.parse(raw);
  return ministryRpc(client,"ministry_propose_research",{p_document_id:input.documentId,p_expected_revision:input.expectedRevision,p_request_id:input.requestId,p_patch:input.patch,p_reason:input.reason,p_evidence:input.evidence},researchProposal);
}
export async function decideProposal(client:Client,raw:unknown) {
  const input=decideResearch.parse(raw);
  return ministryRpc(client,"ministry_decide_research",{p_proposal_id:input.proposalId,p_expected_revision:input.expectedRevision,p_decision:input.decision},documentResult);
}
export async function documentHistory(client:Client,rawKind:unknown,rawId:unknown) {
  return ministryRpc(client,"ministry_document_history",{p_kind:ministryDocumentKind.parse(rawKind),p_document_id:z.string().uuid().parse(rawId)},historyResult);
}
export const teachingAttentionResult=z.object({items:z.array(z.object({
  id:z.string().uuid(),title:z.string(),dueDate:z.iso.date(),revision:z.number().int().positive(),reason:z.string(),priority:z.enum(["high","normal"])
}).strict()).max(10)}).strict();
export async function teachingAttention(client:Client) {return ministryRpc(client,"ministry_teaching_attention",{},teachingAttentionResult);}
