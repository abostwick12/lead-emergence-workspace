import {investorHttp,investorQuery} from "@/lib/investor-bundle/http";
import {listProposals,proposeDocument} from "@/lib/investor-bundle/server";
type Context={params:Promise<{kind:string}>};
export async function GET(request:Request,context:Context){return investorHttp(request,async client=>{const p=investorQuery(request,["offset","status"]);return listProposals(client,(await context.params).kind,Number(p.get("offset")??0),p.get("status")??"pending");});}
export async function POST(request:Request,context:Context){return investorHttp(request,async(client,input)=>{investorQuery(request,[]);return proposeDocument(client,input,(await context.params).kind);},true);}
