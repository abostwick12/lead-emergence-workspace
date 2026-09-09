import {executiveHttp,executiveQuery} from "@/lib/executive-bundle/http";
import {decideProposal} from "@/lib/executive-bundle/server";
export async function POST(request:Request){return executiveHttp(request,(client,input)=>{executiveQuery(request,[]);return decideProposal(client,input);},true);}
