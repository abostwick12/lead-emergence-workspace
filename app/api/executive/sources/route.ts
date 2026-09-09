import {executiveHttp,executiveQuery} from "@/lib/executive-bundle/http";
import {getSharing,setSharing} from "@/lib/executive-bundle/server";
export async function GET(request:Request){return executiveHttp(request,client=>{executiveQuery(request,[]);return getSharing(client);});}
export async function POST(request:Request){return executiveHttp(request,(client,input)=>{executiveQuery(request,[]);return setSharing(client,input);},true);}
