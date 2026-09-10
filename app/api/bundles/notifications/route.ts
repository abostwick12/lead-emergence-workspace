import {authenticatedBundleClient,BundleApiError,readBearerToken} from "@/lib/workspace/bundle-server";
import {notificationQuery,notificationChange,notificationSnapshot,notificationReceipt} from "@/vendor/lead-emergence-bundles/domain-contracts/workspace-notifications";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store, private",Vary:"Authorization"};
function fail(e:unknown){
 const status=e instanceof BundleApiError?e.status:503;
 return Response.json({message:status===401?"Sign in to review notifications.":status===403?"Notification access or a source is unavailable. Refresh your workspace access.":status===409?"Notifications or your choices changed. Refresh and review again.":status===400?"Choose a valid notification view or reviewed change.":"Notifications could not be verified. Refresh to check current saved work."},{status,headers});
}
function rpcError(code:string){return new BundleApiError("Notifications unavailable",code==="42501"?403:code==="40001"?409:code==="22023"?400:503);}
export async function GET(request:Request){
 try{
  const {client}=await authenticatedBundleClient(readBearerToken(request)),params=new URL(request.url).searchParams;
  if([...params.keys()].some(k=>!["offset","view","typeId"].includes(k)||params.getAll(k).length!==1))throw new BundleApiError("Invalid query",400);
  const offset=params.get("offset");if(offset!==null&&!/^(0|[1-9][0-9]*)$/.test(offset))throw new BundleApiError("Invalid page",400);
  const parsed=notificationQuery.safeParse({offset:offset===null?0:Number(offset),view:params.get("view")??"inbox",...(params.has("typeId")?{typeId:params.get("typeId")}:{})});
  if(!parsed.success)throw new BundleApiError("Invalid query",400);
  const p=parsed.data,{data,error}=await client.rpc("native_notifications",{p_view:p.view,p_type_id:p.typeId??null,p_offset:p.offset});
  if(error)throw rpcError(error.code);return Response.json(notificationSnapshot.parse(data),{headers});
 }catch(e){return fail(e);}
}
export async function POST(request:Request){
 try{
  const {client}=await authenticatedBundleClient(readBearerToken(request));
  if(new URL(request.url).search)throw new BundleApiError("Invalid query",400);
  const reader=request.body?.getReader();if(!reader)throw new BundleApiError("Invalid change",400);
  const chunks:Uint8Array[]=[];let bytes=0;
  try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;
   if(bytes>12000){await reader.cancel();throw new BundleApiError("Invalid change",400);}chunks.push(part.value);}}
  finally{reader.releaseLock();}
  let raw:unknown;try{raw=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new BundleApiError("Invalid change",400);}
  const parsed=notificationChange.safeParse(raw);if(!parsed.success)throw new BundleApiError("Invalid change",400);
  const {data,error}=await client.rpc("native_change_notifications",{p_change:parsed.data});
  if(error)throw rpcError(error.code);return Response.json(notificationReceipt.parse(data),{headers});
 }catch(e){return fail(e);}
}
