import {executiveHttp,executiveQuery} from "@/lib/executive-bundle/http";
import {changeDelivery,listDeliveries} from "@/lib/executive-bundle/server";

export async function GET(request:Request){
 return executiveHttp(request,client=>{executiveQuery(request,[]);return listDeliveries(client);});
}
export async function POST(request:Request){
 return executiveHttp(request,(client,input)=>{executiveQuery(request,[]);return changeDelivery(client,input);},true);
}
