import "server-only";
import { ZodError } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticatedBundleClient, BundleApiError, readBearerToken } from "@/lib/workspace/bundle-server";
type Client=SupabaseClient<any,any,any,any,any>;
const headers={"Cache-Control":"no-store, private",Vary:"Authorization"};
export function executiveQuery(request:Request,keys:string[]) {
  const params=new URL(request.url).searchParams;
  if([...params.keys()].some(k=>!keys.includes(k)||params.getAll(k).length!==1)) throw new BundleApiError("Use only the requested Executive fields.",400);
  return params;
}
export async function executiveHttp(request:Request,operation:(client:Client,input?:unknown)=>Promise<unknown>,mutation=false) {
  try {
    const {client}=await authenticatedBundleClient(readBearerToken(request));
    let input:unknown;
    if(mutation) {
      if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new BundleApiError("Use a JSON request.",415);
      const reader=request.body?.getReader();if(!reader)throw new BundleApiError("Add your record details.",400);
      const chunks:Uint8Array[]=[];let size=0;
      try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>650000){await reader.cancel();throw new BundleApiError("This record is too large. Shorten the coordination notes or split the record.",413);}chunks.push(value);}}
      finally {reader.releaseLock();}
      try {input=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new BundleApiError("Check the request format.",400);}
    }
    return Response.json(await operation(client,input),{headers});
  } catch(error) {
    const status=error instanceof BundleApiError?error.status:error instanceof ZodError?400:503;
    return Response.json({message:error instanceof BundleApiError?error.message:status===400?"Check the Executive record, source access, and revision.":"Executive is temporarily unavailable. You can safely retry."},{status,headers});
  }
}
