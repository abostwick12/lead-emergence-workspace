import {executiveHttp,executiveQuery} from "@/lib/executive-bundle/http";
import {searchDocuments,saveDocument} from "@/lib/executive-bundle/server";
type Context={params:Promise<{kind:string}>};
export async function GET(request:Request,context:Context){return executiveHttp(request,async client=>{const {kind}=await context.params,p=executiveQuery(request,["search","offset","limit"]);return searchDocuments(client,kind,{search:p.get("search")??"",offset:Number(p.get("offset")??0),limit:Number(p.get("limit")??25)});});}
export async function POST(request:Request,context:Context){return executiveHttp(request,async(client,input)=>{executiveQuery(request,[]);return saveDocument(client,input,(await context.params).kind);},true);}
