import "server-only";
import {ZodError} from "zod";
import type {SupabaseClient} from "@supabase/supabase-js";
import {authenticatedBundleClient,BundleApiError,readBearerToken} from "@/lib/workspace/bundle-server";
export async function preparationRead(request:Request,operation:(client:SupabaseClient<any,any,any,any,any>)=>Promise<unknown>){
 const headers={"Cache-Control":"no-store, private",Vary:"Authorization"};
 try {const {client}=await authenticatedBundleClient(readBearerToken(request));return Response.json(await operation(client),{headers});}
 catch(e){return Response.json({message:e instanceof BundleApiError?e.message:e instanceof ZodError?"Check the requested resource revision.":"Writing preparation is temporarily unavailable."},{status:e instanceof BundleApiError?e.status:e instanceof ZodError?400:503,headers});}
}
export function preparationQuery(request:Request,keys:string[]){
 const params=new URL(request.url).searchParams;
 if([...params.keys()].some(key=>!keys.includes(key)||params.getAll(key).length!==1))throw new BundleApiError("Use only the requested preparation fields.",400);
 return params;
}
