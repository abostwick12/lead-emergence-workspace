import {nonprofitHttp,nonprofitQuery} from "@/lib/nonprofit-bundle/http";
import {nextMoves} from "@/lib/nonprofit-bundle/server";
export async function GET(request:Request){return nonprofitHttp(request,client=>{nonprofitQuery(request,[]);return nextMoves(client);});}
