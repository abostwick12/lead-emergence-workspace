import {investorHttp,investorQuery} from "@/lib/investor-bundle/http";
import {decideProposal} from "@/lib/investor-bundle/server";
export async function POST(request:Request){return investorHttp(request,(client,input)=>{investorQuery(request,[]);return decideProposal(client,input);},true);}
