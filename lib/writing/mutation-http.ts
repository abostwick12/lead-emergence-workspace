import "server-only";
import { ZodError } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticatedBundleClient, BundleApiError, readBearerToken } from "@/lib/workspace/bundle-server";
const headers = { "Cache-Control": "no-store, private", Vary: "Authorization" };
export async function writingMutation(request: Request, operation: (client: SupabaseClient<any, any, any, any, any>, input: unknown) => Promise<unknown>) {
  try {
    const { client } = await authenticatedBundleClient(readBearerToken(request));
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new BundleApiError("Use a JSON request.", 415);
    // Bearer-only authorization (no ambient cookies), no permissive CORS, bounded
    // streaming body even when Content-Length is missing or malicious.
    const reader = request.body?.getReader();
    if (!reader) throw new BundleApiError("Add the resource or proposal details.", 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 650000) { await reader.cancel(); throw new BundleApiError("This resource is too large. Use up to 100,000 characters of source text.", 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let input: unknown;
    try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new BundleApiError("Check the request format.", 400); }
    return Response.json(await operation(client, input), { headers });
  } catch (error) {
    const status = error instanceof BundleApiError ? error.status : error instanceof ZodError ? 400 : 503;
    return Response.json({ message: error instanceof BundleApiError ? error.message : status === 400 ? "Check the resource, revision, and source details." : "We couldn't save this change. You can safely retry." }, { status, headers });
  }
}
