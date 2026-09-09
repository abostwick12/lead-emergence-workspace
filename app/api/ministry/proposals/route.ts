import {proposeResearch} from "@/lib/ministry-bundle/server";
import {ministryHttp,ministryQuery} from "@/lib/ministry-bundle/http";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request:Request){return ministryHttp(request,(client,input)=>{ministryQuery(request,[]);return proposeResearch(client,input);},true);}
