import {executiveHttp,executiveQuery} from "@/lib/executive-bundle/http";
import {attention} from "@/lib/executive-bundle/server";
export async function GET(request:Request){return executiveHttp(request,client=>{
 const p=executiveQuery(request,["asOfDate"]);return attention(client,p.has("asOfDate")?{asOfDate:p.get("asOfDate")}:{});
});}
