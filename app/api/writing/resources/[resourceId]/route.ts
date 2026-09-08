import { z } from "zod";
import { authenticatedBundleClient, BundleApiError, readBearerToken } from "@/lib/workspace/bundle-server";
import { getWritingResource } from "@/lib/writing/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ resourceId: string }> }) {
  const headers = { "Cache-Control": "no-store, private", Vary: "Authorization" };
  try {
    const { client } = await authenticatedBundleClient(readBearerToken(request));
    const { resourceId } = await context.params;
    if (!z.string().uuid().safeParse(resourceId).success || new URL(request.url).search) {
      return Response.json({ message: "Resource unavailable." }, { status: 404, headers });
    }
    return Response.json(await getWritingResource(client, resourceId), { headers });
  } catch (error) {
    return Response.json({ message: "Resource unavailable." }, { status: error instanceof BundleApiError ? error.status : 503, headers });
  }
}
