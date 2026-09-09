import {getPublicationPacket} from "@/lib/writing/publication-server";
import {preparationQuery,preparationRead} from "@/lib/writing/preparation-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{resourceId:string}>}){
 return preparationRead(request,async client=>{
  const params=preparationQuery(request,["revision"]),{resourceId}=await context.params;
  return getPublicationPacket(client,{resourceId,expectedRevision:Number(params.get("revision"))});
 });
}
