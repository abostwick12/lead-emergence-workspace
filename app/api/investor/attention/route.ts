import {investorHttp,investorQuery} from "@/lib/investor-bundle/http";
import {nextMoves} from "@/lib/investor-bundle/server";
export async function GET(request:Request){return investorHttp(request,client=>{investorQuery(request,[]);return nextMoves(client);});}
