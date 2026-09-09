import {getDocument,saveDocument,searchDocuments} from "@/lib/ministry-bundle/server";
import {ministryHttp,ministryQuery} from "@/lib/ministry-bundle/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{kind:string}>};
export async function GET(request:Request,{params}:Context) {
  const {kind}=await params;
  return ministryHttp(request,client=>{
    const q=ministryQuery(request,kind==="profile"?[]:["search","status","offset","limit"]);
    return kind==="profile"?getDocument(client,kind):searchDocuments(client,kind,{search:q.get("search")??"",...(q.has("status")?{status:q.get("status")} :{}),offset:q.has("offset")?Number(q.get("offset")):0,limit:q.has("limit")?Number(q.get("limit")):25});
  });
}
export async function POST(request:Request,{params}:Context) {const {kind}=await params;return ministryHttp(request,(client,input)=>{ministryQuery(request,[]);return saveDocument(client,input,kind);},true);}
