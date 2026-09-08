import { ZodError } from "zod";
import { authenticatedBundleClient, BundleApiError, readBearerToken } from "@/lib/workspace/bundle-server";
import { getWritingHistory } from "@/lib/writing/revisions-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ resourceId: string }> }) {
  const headers = { "Cache-Control": "no-store, private", Vary: "Authorization" };
  try {
    const { client } = await authenticatedBundleClient(readBearerToken(request));
    return Response.json(await getWritingHistory(client, (await context.params).resourceId), { headers });
  } catch (error) {
    return Response.json({ message: "Revision history is unavailable. Please try again." }, {
      status: error instanceof BundleApiError ? error.status : error instanceof ZodError ? 400 : 503, headers
    });
  }
}
