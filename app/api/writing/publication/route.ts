import { ZodError } from "zod";
import { authenticatedBundleClient, BundleApiError, readBearerToken } from "@/lib/workspace/bundle-server";
import { listPublicationQueue, savePublicationQueue } from "@/lib/writing/publication-queue-server";
import { writingMutation } from "@/lib/writing/mutation-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store, private",Vary:"Authorization"};
export async function GET(request:Request){
  try{
    const {client}=await authenticatedBundleClient(readBearerToken(request)),params=new URL(request.url).searchParams;
    if([...params.keys()].some(key=>!["stage","offset","limit"].includes(key)||params.getAll(key).length!==1))throw new BundleApiError("Use only publication stage, offset, and limit.",400);
    return Response.json(await listPublicationQueue(client,{stage:params.get("stage")??undefined,offset:params.has("offset")?Number(params.get("offset")):0,limit:params.has("limit")?Number(params.get("limit")):25}),{headers});
  }catch(error){
    const status=error instanceof BundleApiError?error.status:error instanceof ZodError?400:503;
    return Response.json({message:error instanceof BundleApiError?error.message:status===400?"Check the publication queue filters.":"The publication queue is temporarily unavailable."},{status,headers});
  }
}
export async function POST(request:Request){return writingMutation(request,savePublicationQueue,{missingMessage:"Add the publication queue decision.",invalidMessage:"Review the exact revision, destination, and confirmations."});}
