import { investorHttp, investorQuery } from "@/lib/investor-bundle/http";
import { getPublicFilings } from "@/lib/investor-bundle/public-filings";
export async function GET(request: Request) {
  return investorHttp(request, client => {
    const q = investorQuery(request, ["cik", "forms", "limit"]);
    return getPublicFilings(client, { cik: q.get("cik"), forms: q.get("forms")?.split(",").filter(Boolean) ?? [],
      limit: q.has("limit") ? Number(q.get("limit")) : 25 });
  });
}
