import {authenticatedBundleClient,BundleApiError,readBearerToken} from "@/lib/workspace/bundle-server";
import {nativeAttentionCatalog,nativeAttentionInput,nativeAttentionResult} from "@/vendor/lead-emergence-bundles/domain-contracts/workspace-attention";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store, private",Vary:"Authorization"};
function fail(e:unknown){
 const status=e instanceof BundleApiError?e.status:503;
 return Response.json({message:status===401?"Sign in to review your attention.":status===403?"This attention source is unavailable for this account.":status===409?"Your access changed. Refresh this page to verify attention sources.":status===400?"Choose a valid date, source, priority and page.":"Attention could not be checked. No partial or previous results are shown; please retry."},{status,headers});
}
function rpcError(code:string){return new BundleApiError("Attention unavailable",code==="42501"?403:code==="40001"?409:code==="22023"?400:503);}
export async function GET(request:Request){
 try{
  const {client}=await authenticatedBundleClient(readBearerToken(request));
  if(new URL(request.url).search)throw new BundleApiError("Invalid request",400);
  const {data,error}=await client.rpc("native_attention_catalog");if(error)throw rpcError(error.code);
  return Response.json(nativeAttentionCatalog.parse(data),{headers});
 }catch(e){return fail(e);}
}
export async function POST(request:Request){
 try{
  const {client}=await authenticatedBundleClient(readBearerToken(request));
  if(new URL(request.url).search)throw new BundleApiError("Invalid request",400);
  const reader=request.body?.getReader();if(!reader)throw new BundleApiError("Invalid input",400);
  const chunks:Uint8Array[]=[];let bytes=0;
  try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;
   if(bytes>4000){await reader.cancel();throw new BundleApiError("Invalid input",400);}chunks.push(part.value);}}
  finally{reader.releaseLock();}
  let raw:unknown;try{raw=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new BundleApiError("Invalid input",400);}
  const parsed=nativeAttentionInput.safeParse(raw);if(!parsed.success)throw new BundleApiError("Invalid input",400);
  const p=parsed.data,{data,error}=await client.rpc("native_attention",{p_as_of_date:p.asOfDate,p_authority_revision:p.authorityRevision,p_bundle_key:p.bundleKey,p_priority:p.priority,p_offset:p.offset});
  if(error)throw rpcError(error.code);
  return Response.json(nativeAttentionResult.parse(data),{headers});
 }catch(e){return fail(e);}
}
