import {ZodError} from "zod";
import {authenticatedBundleClient,BundleApiError,readBearerToken} from "@/lib/workspace/bundle-server";
import {decideWorkspaceLayoutProposal} from "@/lib/bundles/layout-proposals";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store, private",Vary:"Authorization"};
export async function POST(request:Request){
 try{
  const {client}=await authenticatedBundleClient(readBearerToken(request));
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))throw new BundleApiError("Use a JSON request.",415);
  const reader=request.body?.getReader();if(!reader)throw new BundleApiError("Add the proposal decision.",400);
  const chunks:Uint8Array[]=[];let bytes=0;
  try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>65000){await reader.cancel();throw new BundleApiError("The proposal decision is too large.",413);}chunks.push(part.value);}}
  finally{reader.releaseLock();}
  let raw:unknown;try{raw=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new BundleApiError("Check the proposal decision format.",400);}
  return Response.json(await decideWorkspaceLayoutProposal(client,raw),{headers});
 }catch(error){
  const status=error instanceof BundleApiError?error.status:error instanceof ZodError?400:503;
  return Response.json({message:error instanceof BundleApiError?error.message:status===400?"Review and confirm one exact proposal decision.":"The proposal decision is temporarily unavailable. You can safely retry."},{status,headers});
 }
}
