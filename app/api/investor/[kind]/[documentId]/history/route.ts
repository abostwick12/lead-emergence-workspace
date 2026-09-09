import {investorHttp,investorQuery} from "@/lib/investor-bundle/http";
import {documentHistory} from "@/lib/investor-bundle/server";
export async function GET(request:Request,context:{params:Promise<{kind:string;documentId:string}>}){return investorHttp(request,async client=>{investorQuery(request,[]);const {kind,documentId}=await context.params;return documentHistory(client,kind,documentId);});}
