import {teachingAttention} from "@/lib/ministry-bundle/server";
import {ministryHttp,ministryQuery} from "@/lib/ministry-bundle/http";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:Request){return ministryHttp(request,client=>{ministryQuery(request,[]);return teachingAttention(client);});}
