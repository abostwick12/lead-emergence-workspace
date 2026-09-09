import {executiveHttp,executiveQuery} from "@/lib/executive-bundle/http";
import {findSources} from "@/lib/executive-bundle/server";
export async function GET(request:Request){return executiveHttp(request,client=>{
 const p=executiveQuery(request,["capabilityId","level","search","after","limit"]);
 return findSources(client,{capabilityId:p.get("capabilityId"),level:p.get("level"),
  ...(p.has("search")?{search:p.get("search")}:{}),...(p.has("after")?{after:p.get("after")}:{}),
  ...(p.has("limit")?{limit:Number(p.get("limit"))}:{})});
});}
