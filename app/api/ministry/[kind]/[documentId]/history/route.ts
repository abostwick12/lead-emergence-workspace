import {documentHistory} from "@/lib/ministry-bundle/server";
import {ministryHttp,ministryQuery} from "@/lib/ministry-bundle/http";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{kind:string;documentId:string}>}) {
 const {kind,documentId}=await params;return ministryHttp(request,client=>{ministryQuery(request,[]);return documentHistory(client,kind,documentId);});
}
