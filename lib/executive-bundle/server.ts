import "server-only";
import {z} from "zod";
import type {SupabaseClient} from "@supabase/supabase-js";
import {BundleApiError} from "@/lib/workspace/bundle-server";
import {executiveKind,executiveResult,executiveSave,executiveSearch,executiveSearchResult,executiveProposalInput,executiveProposal,executiveDecision,executiveDecisionResult,executiveHistory,executiveProposalsResult,executiveAttention,executiveAttentionInput,executiveSharingInput,executiveSharing,executiveResolveInput,executiveResolutionResult,referenceKey} from "./contracts";
type Client=SupabaseClient<any,any,any,any,any>;
import {executiveAttentionQuery,executiveAttentionV2,executiveSharingV2,executiveSharingV2Input,
 executiveSourceSearchInput,executiveSourceSearchResult,sourceCursorKey} from "./contracts";
import {executiveWeeklyQuery,executiveWeeklyReport,weeklyInstantMicros} from "./contracts";
import {executiveDeliveryList,executiveDeliveryMutation,executiveDeliverySchedule} from "./contracts";
export async function weeklyOutcomes(client:Client,raw:unknown) {
 const input=executiveWeeklyQuery.parse(raw);
 const result=await executiveRpc(client,"executive_weekly_outcomes",{
  p_period_start:input.periodStart,p_period_end:input.periodEnd,p_time_zone:input.timeZone,
  ...(input.recordedThrough?{p_recorded_through:input.recordedThrough}:{}),p_offset:input.offset,p_limit:input.limit
 },executiveWeeklyReport);
 if(result.periodStart!==input.periodStart||result.periodEnd!==input.periodEnd||result.timeZone!==input.timeZone
  ||result.offset!==input.offset||result.limit!==input.limit
  ||(input.recordedThrough&&weeklyInstantMicros(result.recordedThrough)!==weeklyInstantMicros(input.recordedThrough)))
  throw new BundleApiError("Weekly outcomes did not match the requested period or page. Refresh before using them.",503);
 return result;
}
export async function listDeliveries(client:Client) {
 return executiveRpc(client,"executive_deliveries",{},executiveDeliveryList);
}
export async function changeDelivery(client:Client,raw:unknown) {
 const input=executiveDeliveryMutation.parse(raw);
 return executiveRpc(client,"executive_change_delivery",{p_change:input},executiveDeliverySchedule);
}
const presentDocument=executiveResult.refine(result=>result.document!==null,"Expected a saved Executive record.");
export async function executiveRpc<T>(client:Client,name:string,params:Record<string,unknown>,schema:z.ZodType<T>):Promise<T>{
 const {data,error}=await client.rpc(name,params);
 if(error){
  const status=error.code==="54000"?429:error.code==="42501"?403:error.code==="P0002"?404:error.code==="40001"?409:["22023","22P02"].includes(error.code)?400:503;
  throw new BundleApiError(status===429?"Executive is temporarily rate-limited. Wait before retrying; no external action was performed.":status===403?"Your current Executive capability or linked-source access does not allow this action. Refresh access before continuing.":status===404?"This Executive record is unavailable.":status===409?"This record, proposal, schedule or source selection changed. Your work was not applied. Refresh and compare the latest version before retrying.":status===400?"Check the Executive record, dates, schedule, source references and exact confirmation.":"Executive is temporarily unavailable. You can safely retry.",status);
 }
 const result=schema.safeParse(data);
 if(!result.success)throw new BundleApiError("We could not verify the Executive response. Please retry.",503);
 return result.data;
}
export async function getDocument(client:Client,rawKind:unknown,rawId:unknown){
 return executiveRpc(client,"executive_get_document",{p_kind:executiveKind.parse(rawKind),p_document_id:z.string().uuid().parse(rawId)},presentDocument);
}
export async function searchDocuments(client:Client,rawKind:unknown,raw:unknown){
 const input=executiveSearch.parse(raw);
 return executiveRpc(client,"executive_search_documents",{p_kind:executiveKind.parse(rawKind),p_search:input.search,p_offset:input.offset,p_limit:input.limit},executiveSearchResult);
}
export async function saveDocument(client:Client,raw:unknown,expectedKind:string){
 const input=executiveSave.parse(raw);
 if(input.kind!==expectedKind)throw new BundleApiError("Record type does not match this workspace.",400);
 return executiveRpc(client,"executive_save_document",{p_kind:input.kind,p_document_id:input.documentId,p_expected_revision:input.expectedRevision,p_request_id:input.requestId,p_data:input.data,p_confirm_exact_record:input.confirmExactRecord},presentDocument);
}
export async function proposeDocument(client:Client,raw:unknown,expectedKind:string){
 const input=executiveProposalInput.parse(raw);
 if(input.kind!==expectedKind)throw new BundleApiError("Record type does not match this proposal.",400);
 return executiveRpc(client,"executive_propose_document",{p_kind:input.kind,p_document_id:input.documentId,p_expected_revision:input.expectedRevision,p_request_id:input.requestId,p_data:input.data,p_reason:input.reason,p_evidence:input.evidence,p_scope:input.scope},executiveProposal);
}
export async function listProposals(client:Client,rawKind:unknown,offset:unknown,status:unknown="pending"){
 return executiveRpc(client,"executive_list_proposals",{p_kind:executiveKind.parse(rawKind),p_offset:z.number().int().min(0).max(10000).parse(offset),p_status:z.enum(["pending","approved","rejected"]).parse(status)},executiveProposalsResult);
}
export async function decideProposal(client:Client,raw:unknown){
 const input=executiveDecision.parse(raw);
 return executiveRpc(client,"executive_decide_proposal",{p_proposal_id:input.proposalId,p_expected_revision:input.expectedRevision,p_decision:input.decision,p_confirm_exact_record:input.confirmExactRecord},executiveDecisionResult);
}
export async function documentHistory(client:Client,rawKind:unknown,rawId:unknown){
 return executiveRpc(client,"executive_document_history",{p_kind:executiveKind.parse(rawKind),p_document_id:z.string().uuid().parse(rawId)},executiveHistory);
}
export async function attention(client:Client,raw:unknown={}) {
 const input=executiveAttentionInput.parse(raw);
 return executiveRpc(client,"executive_attention",input.asOfDate?{p_as_of_date:input.asOfDate}:{},executiveAttention);
}
export async function getSharing(client:Client) {return executiveRpc(client,"executive_get_source_permissions",{},executiveSharing);}
export async function reviewAttention(client:Client,raw:unknown={}) {
 const input=executiveAttentionQuery.parse(raw);
 const result=await executiveRpc(client,"executive_review_attention",{
  ...(input.asOfDate?{p_as_of_date:input.asOfDate}:{}),p_offset:input.offset,p_limit:input.limit
 },executiveAttentionV2);
 if(result.offset!==input.offset||result.limit!==input.limit||(input.asOfDate&&result.asOfDate!==input.asOfDate))
  throw new BundleApiError("Attention did not match the requested date or page. Please refresh.",503);
 return result;
}
export async function getSharingV2(client:Client) {return executiveRpc(client,"executive_get_source_permissions_v2",{},executiveSharingV2);}
export async function setSharingV2(client:Client,raw:unknown) {
 const input=executiveSharingV2Input.parse(raw);
 return executiveRpc(client,"executive_set_source_permissions_v2",{
  p_capabilities:input.sourceCapabilities,p_task_capabilities:input.taskCapabilities,p_expected_revision:input.expectedRevision,
  p_request_id:input.requestId,p_confirm_task_metadata_only:input.confirmTaskMetadataOnly,
  p_confirm_expanded_task_metadata:input.confirmExpandedTaskMetadata,p_task_metadata_version:input.taskMetadataVersion
 },executiveSharingV2);
}
export async function findSources(client:Client,raw:unknown) {
 const input=executiveSourceSearchInput.parse(raw);
 const result=await executiveRpc(client,"executive_find_sources",{
  p_capability:input.capabilityId,p_level:input.level,p_search:input.search,p_after:input.after,p_limit:input.limit
 },executiveSourceSearchResult);
 const keys=result.items.map(x=>sourceCursorKey(x.reference));
 if(result.scope.capabilityId!==input.capabilityId||result.scope.level!==input.level||result.items.length>input.limit
  ||keys.some((key,index)=>(input.after!==null&&key<=input.after)||(index>0&&key<=keys[index-1])))
  throw new BundleApiError("Source results did not match the requested scope or page. Please refresh.",503);
 return result;
}
export async function setSharing(client:Client,raw:unknown) {
 const input=executiveSharingInput.parse(raw);
 return executiveRpc(client,"executive_set_source_permissions",{p_capabilities:input.sourceCapabilities,p_expected_revision:input.expectedRevision,
  p_request_id:input.requestId,p_confirm_task_metadata_only:input.confirmTaskMetadataOnly},executiveSharing);
}
export async function resolveReferences(client:Client,raw:unknown) {
 const input=executiveResolveInput.parse(raw);
 const result=await executiveRpc(client,"executive_resolve_references",{p_references:input.references},executiveResolutionResult);
 if(result.references.length!==input.references.length || result.references.some((item,index)=>
  referenceKey(item.reference)!==referenceKey(input.references[index]) || item.reference.revision!==input.references[index].revision))
  throw new BundleApiError("We could not match the returned source references. Please refresh.",503);
 return result;
}
