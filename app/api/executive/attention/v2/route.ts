import {executiveHttp,executiveQuery} from "@/lib/executive-bundle/http";
import {reviewAttention} from "@/lib/executive-bundle/server";
export async function GET(request:Request){return executiveHttp(request,client=>{
 const p=executiveQuery(request,["asOfDate","offset","limit"]);
 return reviewAttention(client,{...(p.has("asOfDate")?{asOfDate:p.get("asOfDate")}:{ }),
  ...(p.has("offset")?{offset:Number(p.get("offset"))}:{}),...(p.has("limit")?{limit:Number(p.get("limit"))}:{})});
});}
