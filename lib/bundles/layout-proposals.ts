import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ComposedUiManifest } from "@/vendor/lead-emergence-bundles/ui-manifest";
import {
  layoutProposalContext,layoutProposalDecision,layoutProposalDecisionResult,layoutProposalInput,layoutProposalList,
  layoutProposalReceipt
} from "@/vendor/lead-emergence-bundles/domain-contracts/layout-proposal";
import {layoutIdentityFor,workspaceLayoutCatalog} from "@/vendor/lead-emergence-bundles/domain-contracts/workspace-layout";
import {BundleApiError} from "@/lib/workspace/bundle-server";

type Client=SupabaseClient<any,any,any,any,any>;
const rawContext=z.object({schemaVersion:z.literal("1.0"),workspaceId:z.string().uuid(),layoutRevision:z.number().int().min(0),
 authorityRevision:z.string().min(1),items:z.array(z.object({id:z.string(),bundleKey:z.string(),kind:z.enum(["navigation","widget"]),route:z.string().nullable(),visible:z.boolean(),pinned:z.boolean(),order:z.number().int().nullable()}).strict()),
 defaultRoutes:z.array(z.string()),currentDefaultWorkspaceRoute:z.string(),defaultUnavailable:z.boolean(),dormantChoiceCount:z.number().int().min(0)}).strict();
export {layoutProposalDecisionResult} from "@/vendor/lead-emergence-bundles/domain-contracts/layout-proposal";

function failure(code:string|undefined):BundleApiError {
 return new BundleApiError(
  code==="40001"?"Your layout, access, or proposal changed. Reload and review the current state.":
  code==="42501"?"Workspace layout proposals are unavailable for this account or connection.":
  code==="P0002"?"This layout proposal is unavailable.":
  code==="22023"?"Review a valid grounded layout proposal and exact decision.":
  "Layout proposals are temporarily unavailable. You can safely retry.",
  code==="40001"?409:code==="42501"?403:code==="P0002"?404:code==="22023"?400:503
 );
}
function checked<T>(result:{data:unknown;error:{code?:string}|null},schema:z.ZodType<T>):T{
 if(result.error)throw failure(result.error.code);return schema.parse(result.data);
}

export async function getLayoutProposalContext(client:Client,ui:ComposedUiManifest){
 const raw=checked(await client.rpc("layout_proposal_context"),rawContext),catalog=workspaceLayoutCatalog(ui);
 const labels=new Map([...catalog.navigation,...catalog.widgets].map(item=>[layoutIdentityFor(item),item.label]));
 const defaults=new Map(catalog.defaultWorkspaces.map(item=>[item.route,item.label]));
 return layoutProposalContext.parse({schemaVersion:"1.0",workspaceId:raw.workspaceId,layoutRevision:raw.layoutRevision,
  authorityRevision:raw.authorityRevision,items:raw.items.map(item=>({...item,label:labels.get(item.id)??item.id})),
  defaultWorkspaces:raw.defaultRoutes.map(route=>({route,label:defaults.get(route)??(route==="/workspace"?"Home":route),current:route===raw.currentDefaultWorkspaceRoute})),
  defaultUnavailable:raw.defaultUnavailable,dormantChoiceCount:raw.dormantChoiceCount});
}

export async function proposeWorkspaceLayout(client:Client,raw:unknown){
 const input=layoutProposalInput.parse(raw);
 return checked(await client.rpc("propose_workspace_layout",{expected_layout_revision:input.expectedLayoutRevision,
  expected_authority_revision:input.expectedAuthorityRevision,request_id:input.requestId,proposal_title:input.title,
  proposal_goal:input.goal,goal_source:input.goalSource,proposal_summary:input.summary,operations:input.operations}),layoutProposalReceipt);
}
export async function listWorkspaceLayoutProposals(client:Client){
 return checked(await client.rpc("list_workspace_layout_proposals"),layoutProposalList);
}
export async function decideWorkspaceLayoutProposal(client:Client,raw:unknown){
 const input=layoutProposalDecision.parse(raw);
 return checked(await client.rpc("decide_workspace_layout_proposal",{proposal_id:input.proposalId,
  expected_proposal_version:input.expectedProposalVersion,expected_layout_revision:input.expectedLayoutRevision,
  expected_authority_revision:input.expectedAuthorityRevision,request_id:input.requestId,decision:input.decision,
  confirmed:input.confirmed,decision_note:input.note}),layoutProposalDecisionResult);
}
