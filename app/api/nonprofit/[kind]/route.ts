import {nonprofitHttp,nonprofitQuery} from "@/lib/nonprofit-bundle/http";
import {searchDocuments,saveDocument} from "@/lib/nonprofit-bundle/server";
type Context={params:Promise<{kind:string}>};
export async function GET(request:Request,context:Context){return nonprofitHttp(request,async client=>{const {kind}=await context.params,p=nonprofitQuery(request,["search","offset","limit"]);return searchDocuments(client,kind,{search:p.get("search")??"",offset:Number(p.get("offset")??0),limit:Number(p.get("limit")??25)});});}
export async function POST(request:Request,context:Context){return nonprofitHttp(request,async(client,input)=>{nonprofitQuery(request,[]);return saveDocument(client,input,(await context.params).kind);},true);}
