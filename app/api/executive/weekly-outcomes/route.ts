import {executiveHttp,executiveQuery} from "@/lib/executive-bundle/http";
import {weeklyOutcomes} from "@/lib/executive-bundle/server";
export async function GET(request:Request) {
 return executiveHttp(request,client=>{
  const p=executiveQuery(request,["periodStart","periodEnd","timeZone","recordedThrough","offset","limit"]);
  return weeklyOutcomes(client,{
   periodStart:p.get("periodStart"),periodEnd:p.get("periodEnd"),timeZone:p.get("timeZone"),
   ...(p.has("recordedThrough")?{recordedThrough:p.get("recordedThrough")}:{}),
   ...(p.has("offset")?{offset:Number(p.get("offset"))}:{}),
   ...(p.has("limit")?{limit:Number(p.get("limit"))}:{})
  });
 });
}
