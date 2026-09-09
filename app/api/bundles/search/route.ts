import {authenticatedBundleClient,BundleApiError,readBearerToken} from "@/lib/workspace/bundle-server";
import {workspaceSearchCatalogSchema,workspaceSearchInputSchema,workspaceSearchResultSchema} from "@/vendor/lead-emergence-bundles/domain-contracts/workspace-discovery";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store, private",Vary:"Authorization"};
function failure(error:unknown){
 const status=error instanceof BundleApiError?error.status:503;
 return Response.json({message:status===401?"Sign in to search your saved work.":status===409?"Your access changed. Reload search scopes and try again.":status===403?"This search scope is unavailable for this account.":status===400?"Choose at least one available scope and a search of 2–200 characters.":"Search could not be completed. No partial results are shown; please retry."},{status,headers});
}
export async function GET(request:Request){
 try{
  const {client}=await authenticatedBundleClient(readBearerToken(request));
  const {data,error}=await client.rpc("search_saved_work_catalog");
  if(error)throw new BundleApiError("Search unavailable",error.code==="42501"?403:503);
  return Response.json(workspaceSearchCatalogSchema.parse(data),{headers});
 }catch(error){return failure(error);}
}
export async function POST(request:Request){
 try{
  const {client}=await authenticatedBundleClient(readBearerToken(request));
  const reader=request.body?.getReader();if(!reader)throw new BundleApiError("Invalid search",400);
  const chunks:Uint8Array[]=[];let bytes=0;
  try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;
   if(bytes>8000){await reader.cancel();throw new BundleApiError("Invalid search",400);}chunks.push(part.value);}}
  finally{reader.releaseLock();}
  let raw:unknown;try{raw=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new BundleApiError("Invalid search",400);}
  const parsed=workspaceSearchInputSchema.safeParse(raw);if(!parsed.success)throw new BundleApiError("Invalid search",400);
  const p=parsed.data,{data,error}=await client.rpc("search_saved_work",{p_query:p.query,p_provider_ids:p.providerIds,p_authority_revision:p.authorityRevision,p_offset:p.offset});
  if(error)throw new BundleApiError("Search unavailable",error.code==="40001"?409:error.code==="42501"?403:error.code==="22023"?400:503);
  return Response.json(workspaceSearchResultSchema.parse(data),{headers});
 }catch(error){return failure(error);}
}
