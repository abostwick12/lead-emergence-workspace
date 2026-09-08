import { authenticatedBundleClient, BundleApiError, readBearerToken } from "@/lib/workspace/bundle-server";
import { resolveBundleExperience } from "@/lib/bundles/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store, private", Vary: "Authorization" };
  try {
    const { client, user } = await authenticatedBundleClient(readBearerToken(request));
    return Response.json(await resolveBundleExperience(client, user.id), { headers });
  } catch (error) {
    return Response.json({ message: "Bundle access could not be verified. Please try again." },
      { status: error instanceof BundleApiError ? error.status : 503, headers });
  }
}
