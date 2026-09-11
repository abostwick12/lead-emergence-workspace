import "server-only";
import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {BaseBundleExperience} from "./experience";
import {layoutProposalContext,layoutProposalInput,layoutProposalReceipt} from "@/vendor/lead-emergence-bundles/domain-contracts/layout-proposal";
import {getLayoutProposalContext,proposeWorkspaceLayout} from "./layout-proposals";
import {BundleApiError} from "@/lib/workspace/bundle-server";

export function registerWorkspaceLayoutProposalTools(server:McpServer,client:SupabaseClient<any,any,any,any,any>,capabilities:string[],experience?:BaseBundleExperience){
 if(!experience||!capabilities.includes("workspace.personalize"))return;
 const security={securitySchemes:[{type:"oauth2" as const,scopes:["openid","email","profile"]}]};
 server.registerTool("workspace_layout_proposal_context",{
  title:"Read safe Workspace layout context",
  description:"Read the current capability-filtered navigation, widgets, active layout choices, available starting workspaces, exact layout/access revisions, and only a count of dormant choices. No domain content or unavailable item identity is returned. Use this before proposing a layout and never invent IDs or routes.",
  inputSchema:{},outputSchema:layoutProposalContext,
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},_meta:security
 },async()=>toolResult(()=>getLayoutProposalContext(client,experience.ui)));
 server.registerTool("workspace_propose_layout",{
  title:"Propose a grounded Workspace layout",
  description:"Store an immutable layout recommendation for native user review. Use exact revisions and admitted IDs/routes from workspace_layout_proposal_context. Every bounded operation needs a clear reason and a non-inference basis. This never changes, approves, hides, reorders, or saves the user's layout; direct the user to Workspace layout to preview and decide.",
  inputSchema:layoutProposalInput.omit({schemaVersion:true}),outputSchema:layoutProposalReceipt,
  annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false},_meta:security
 },async input=>toolResult(()=>proposeWorkspaceLayout(client,{schemaVersion:"1.0",...input})));
}
async function toolResult(operation:()=>Promise<object>){
 try{const result=await operation();return {content:[{type:"text" as const,text:JSON.stringify(result)}],structuredContent:result as Record<string,unknown>};}
 catch(error){return {isError:true,content:[{type:"text" as const,text:error instanceof BundleApiError?error.message:"Workspace layout context or proposal could not be verified. Refresh access before retrying."}]};}
}
