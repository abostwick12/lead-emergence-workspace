import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BundleApiError } from "@/lib/workspace/bundle-server";
import { publicFilingsInput, type PublicFilingsResult } from "./contracts";
import { parseSecSubmissions } from "./public-filings-data";
import { investorRpc } from "./server";

type Client = SupabaseClient<any, any, any, any, any>;
const allowed = z.object({ allowed: z.literal(true) }).strict();
export async function getPublicFilings(client: Client, raw: unknown): Promise<PublicFilingsResult> {
  const input = publicFilingsInput.parse(raw);
  await investorRpc(client, "investor_public_source_access", { p_reserve: true }, allowed);
  const userAgent = process.env.SEC_PUBLIC_USER_AGENT
    || "LeadEmergenceWorkspace/0.1 (+https://github.com/abostwick12/lead-emergence-workspace)";
  if (userAgent.length < 10 || userAgent.length > 240 || /[\r\n]/.test(userAgent))
    throw new BundleApiError("The public-source client identity needs operator configuration.", 503);
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
  let data: unknown;
  try {
    const response = await fetch("https://data.sec.gov/submissions/CIK" + input.cik + ".json", {
      method: "GET", redirect: "error", cache: "no-store", signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": userAgent }
    });
    if (!response.ok) throw new BundleApiError(response.status === 404 ? "SEC has no submissions record at this CIK."
      : response.status === 403 ? "SEC declined this automated request. No findings were inferred; operator review may be needed."
      : response.status === 429 ? "SEC is limiting requests. Wait before another lookup; no result was inferred."
      : "SEC public data is temporarily unavailable. No result was inferred.", response.status === 404 ? 404 : 503);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Public source body is absent.");
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > 5000000) { await reader.cancel(); throw new BundleApiError("This public filing response exceeds the bounded lookup. No partial result was inferred.", 503); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof BundleApiError) throw error;
    throw new BundleApiError(controller.signal.aborted ? "SEC lookup timed out. No research record was changed."
      : "We could not read the public SEC response. No findings were inferred.", 503);
  } finally { clearTimeout(timeout); }
  let result: PublicFilingsResult;
  try { result = parseSecSubmissions(data, input, new Date().toISOString()); }
  catch { throw new BundleApiError("The public SEC response could not be verified. No partial result was presented.", 503); }
  // A request may outlive revocation. Recheck before releasing even public results.
  await investorRpc(client, "investor_public_source_access", { p_reserve: false }, allowed);
  return result;
}
