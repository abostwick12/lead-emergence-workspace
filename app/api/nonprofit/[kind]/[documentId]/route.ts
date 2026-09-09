import {nonprofitHttp,nonprofitQuery} from "@/lib/nonprofit-bundle/http";
import {getDocument} from "@/lib/nonprofit-bundle/server";
export async function GET(request:Request,context:{params:Promise<{kind:string;documentId:string}>}){return nonprofitHttp(request,async client=>{nonprofitQuery(request,[]);const {kind,documentId}=await context.params;return getDocument(client,kind,documentId);});}
