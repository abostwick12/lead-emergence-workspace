import {executiveHttp,executiveQuery} from "@/lib/executive-bundle/http";
import {listProposals,proposeDocument} from "@/lib/executive-bundle/server";
type Context={params:Promise<{kind:string}>};
export async function GET(request:Request,context:Context){return executiveHttp(request,async client=>{const p=executiveQuery(request,["offset","status"]);return listProposals(client,(await context.params).kind,Number(p.get("offset")??0),p.get("status")??"pending");});}
export async function POST(request:Request,context:Context){return executiveHttp(request,async(client,input)=>{executiveQuery(request,[]);return proposeDocument(client,input,(await context.params).kind);},true);}
