import { getPublicationQueueItem } from "@/lib/writing/publication-queue-server";
import { preparationRead } from "@/lib/writing/preparation-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{resourceId:string}>}){
  return preparationRead(request,async client=>getPublicationQueueItem(client,(await context.params).resourceId));
}
