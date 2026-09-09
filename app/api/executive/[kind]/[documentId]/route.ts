import {executiveHttp,executiveQuery} from "@/lib/executive-bundle/http";
import {getDocument} from "@/lib/executive-bundle/server";
export async function GET(request:Request,context:{params:Promise<{kind:string;documentId:string}>}){return executiveHttp(request,async client=>{executiveQuery(request,[]);const {kind,documentId}=await context.params;return getDocument(client,kind,documentId);});}
