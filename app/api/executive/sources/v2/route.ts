import {executiveHttp,executiveQuery} from "@/lib/executive-bundle/http";
import {getSharingV2,setSharingV2} from "@/lib/executive-bundle/server";
export async function GET(request:Request){return executiveHttp(request,client=>{executiveQuery(request,[]);return getSharingV2(client);});}
export async function POST(request:Request){return executiveHttp(request,(client,input)=>{executiveQuery(request,[]);return setSharingV2(client,input);},true);}
