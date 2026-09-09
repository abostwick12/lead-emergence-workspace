import {nonprofitHttp,nonprofitQuery} from "@/lib/nonprofit-bundle/http";
import {listProposals,proposeDocument} from "@/lib/nonprofit-bundle/server";
type Context={params:Promise<{kind:string}>};
export async function GET(request:Request,context:Context){return nonprofitHttp(request,async client=>{const p=nonprofitQuery(request,["offset","status"]);return listProposals(client,(await context.params).kind,Number(p.get("offset")??0),p.get("status")??"pending");});}
export async function POST(request:Request,context:Context){return nonprofitHttp(request,async(client,input)=>{nonprofitQuery(request,[]);return proposeDocument(client,input,(await context.params).kind);},true);}
