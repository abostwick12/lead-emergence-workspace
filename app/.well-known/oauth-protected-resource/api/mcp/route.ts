import { workspaceProtectedResourceMetadata } from "@/lib/workspace/mcp-auth";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(workspaceProtectedResourceMetadata(), { headers: { "Cache-Control": "public, max-age=300" } });
}
