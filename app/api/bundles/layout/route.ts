import { authenticatedBundleClient, BundleApiError, readBearerToken } from "@/lib/workspace/bundle-server";
import { resolveBundleExperience } from "@/lib/bundles/server";
import { layoutRecordSchema, layoutSaveSchema } from "@/lib/bundles/layout";
import { workspaceLayoutCatalog } from "@/vendor/lead-emergence-bundles/domain-contracts/workspace-layout";
import { listWorkspaceLayoutProposals } from "@/lib/bundles/layout-proposals";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store, private",Vary:"Authorization"};
function failure(error:unknown) {
 const status=error instanceof BundleApiError?error.status:503;
 return Response.json({message:status===409?"Your layout or access changed. Reload the saved layout and review your changes again.":status===403?"Workspace layout is unavailable for this account.":status===400?"Review a valid layout and confirm it before saving.":"Layout could not be verified. Reload to check the saved state before making a different change."},{status,headers});
}
export async function GET(request:Request) {
 try {
  const {client,user}=await authenticatedBundleClient(readBearerToken(request));
  const base=await resolveBundleExperience(client,user.id);
  const {data,error}=await client.rpc("get_workspace_layout");
  if(error)throw new BundleApiError("Layout unavailable",error.code==="42501"?403:503);
  const record=layoutRecordSchema.parse(data);
  if(record.workspaceId!==base.workspaceId || record.authorityRevision!==base.revision)throw new BundleApiError("Access changed",409);
  const proposals=await listWorkspaceLayoutProposals(client);
  if(proposals.workspaceId!==record.workspaceId || proposals.layoutRevision!==record.revision || proposals.authorityRevision!==record.authorityRevision)throw new BundleApiError("Access changed",409);
  return Response.json({record,catalog:workspaceLayoutCatalog(base.ui),proposals}, {headers});
 } catch(error) {return failure(error);}
}
export async function POST(request:Request) {
 try {
  const {client}=await authenticatedBundleClient(readBearerToken(request));
  // Bound the streamed request, including chunked bodies.
  const reader=request.body?.getReader(); if(!reader)throw new BundleApiError("Invalid layout",400);
  const chunks:Uint8Array[]=[];let bytes=0;
  try {for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;
   if(bytes>65000){await reader.cancel();throw new BundleApiError("Invalid layout",400);}chunks.push(part.value);}}
  finally {reader.releaseLock();}
  let raw:unknown;try{raw=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new BundleApiError("Invalid layout",400);}
  const parsed=layoutSaveSchema.safeParse(raw);if(!parsed.success)throw new BundleApiError("Invalid layout",400);
  const p=parsed.data;
  const {data,error}=await client.rpc("save_workspace_layout",{preferences:p.preferences,expected_revision:p.expectedRevision,
   expected_authority_revision:p.expectedAuthorityRevision,request_id:p.requestId,confirmed:p.confirmed});
  if(error)throw new BundleApiError("Layout unavailable",error.code==="40001"?409:error.code==="42501"?403:error.code==="22023"?400:503);
  return Response.json({record:layoutRecordSchema.parse(data)},{headers});
 }catch(error){return failure(error);}
}
