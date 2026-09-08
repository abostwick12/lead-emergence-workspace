import { ZodError } from "zod";
import { authenticatedBundleClient, BundleApiError, readBearerToken } from "@/lib/workspace/bundle-server";
import { listWritingResources } from "@/lib/writing/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store, private", Vary: "Authorization" };
  try {
    const { client } = await authenticatedBundleClient(readBearerToken(request));
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some((key) => !["search","state","offset","limit"].includes(key))) {
      return Response.json({ message: "Use only resource search, state, offset, and limit." }, { status: 400, headers });
    }
    return Response.json(await listWritingResources(client, {
      search: params.get("search") ?? "", state: params.get("state") ?? undefined,
      offset: params.has("offset") ? Number(params.get("offset")) : 0,
      limit: params.has("limit") ? Number(params.get("limit")) : 25
    }), { headers });
  } catch (error) {
    const status = error instanceof BundleApiError ? error.status : error instanceof ZodError ? 400 : 503;
    return Response.json({ message: status === 400 ? "Check your resource search." : "Writing resources are unavailable. Please try again." }, { status, headers });
  }
}
