import {nonprofitHttp,nonprofitQuery} from "@/lib/nonprofit-bundle/http";
import {decideProposal} from "@/lib/nonprofit-bundle/server";
export async function POST(request:Request){return nonprofitHttp(request,(client,input)=>{nonprofitQuery(request,[]);return decideProposal(client,input);},true);}
