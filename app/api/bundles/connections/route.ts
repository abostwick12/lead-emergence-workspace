import {authenticatedBundleClient,BundleApiError,readBearerToken} from "@/lib/workspace/bundle-server";
import {connectionQuery,connectionReview,connectionSnapshot,connectionReceipt} from "@/vendor/lead-emergence-bundles/domain-contracts/workspace-connections";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store, private",Vary:"Authorization"};
function fail(e:unknown){
 const status=e instanceof BundleApiError?e.status:503;
 return Response.json({message:status===401?"Sign in to manage your connections.":status===403?"Use the native connection center as this Workspace's owner.":status===409?"Connection changed or this review was already used. Refresh and review again.":status===400?"Review the exact connection and confirm the change.":"Connections could not be checked. No previous status is shown. Retry to verify current access."},{status,headers});
}
function rpcError(code:string){return new BundleApiError("Connections unavailable",code==="42501"?403:code==="40001"?409:code==="22023"?400:503);}
export async function GET(request:Request){
 try{
  const {client}=await authenticatedBundleClient(readBearerToken(request));
  const params=new URL(request.url).searchParams;
  if([...params.keys()].some(k=>k!=="offset")||params.getAll("offset").length>1)throw new BundleApiError("Invalid page",400);
  const value=params.get("offset");
  if(value!==null&&!/^(0|[1-9][0-9]*)$/.test(value))throw new BundleApiError("Invalid page",400);
  const query=connectionQuery.safeParse({offset:value===null?0:Number(value)});
  if(!query.success)throw new BundleApiError("Invalid page",400);
  const {data,error}=await client.rpc("native_connection_center",{p_offset:query.data.offset});if(error)throw rpcError(error.code);
  return Response.json(connectionSnapshot.parse(data),{headers});
 }catch(e){return fail(e);}
}
export async function POST(request:Request){
 try{
  const {client}=await authenticatedBundleClient(readBearerToken(request));
  if(new URL(request.url).search)throw new BundleApiError("Invalid request",400);
  const reader=request.body?.getReader();if(!reader)throw new BundleApiError("Invalid review",400);
  const chunks:Uint8Array[]=[];let bytes=0;
  try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;
   if(bytes>2000){await reader.cancel();throw new BundleApiError("Invalid review",400);}chunks.push(part.value);}}
  finally{reader.releaseLock();}
  let raw:unknown;try{raw=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new BundleApiError("Invalid review",400);}
  const parsed=connectionReview.safeParse(raw);if(!parsed.success)throw new BundleApiError("Invalid review",400);
  const p=parsed.data,{data,error}=await client.rpc("native_disconnect_connection",{
   p_kind:p.kind,p_id:p.id,p_revision:p.revision,p_request_id:p.requestId,p_confirmed:p.confirmed
  });if(error)throw rpcError(error.code);
  return Response.json(connectionReceipt.parse(data),{headers});
 }catch(e){return fail(e);}
}
