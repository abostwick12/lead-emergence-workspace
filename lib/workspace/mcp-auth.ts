import "server-only";

import { createWorkspaceBearerClient, workspaceSupabaseUrl } from "@/lib/supabase/server";
import { normalizeMcpResourceUri } from "@/lib/workspace/mcp-uri";

export function workspaceMcpResourceUri() {
  const configured = process.env.WORKSPACE_MCP_RESOURCE_URI?.trim();
  if (configured) return normalizeMcpResourceUri(configured);
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://workspace.leademergence.com";
  return normalizeMcpResourceUri(new URL("/api/mcp", origin).toString());
}

export function workspaceProtectedResourceMetadata() {
  return {
    resource: workspaceMcpResourceUri(),
    authorization_servers: [`${workspaceSupabaseUrl().replace(/\/$/, "")}/auth/v1`],
    scopes_supported: ["openid", "email", "profile"],
    bearer_methods_supported: ["header"],
    resource_name: "Lead Emergence Workspace"
  };
}

export function mcpResourceMetadataUri() {
  return new URL("/.well-known/oauth-protected-resource/api/mcp", workspaceMcpResourceUri()).toString();
}

export function mcpUnauthorized(message = "Authorization is required.") {
  return Response.json({ error: "invalid_token", error_description: message }, {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": `Bearer resource_metadata="${mcpResourceMetadataUri()}", scope="openid email profile"`
    }
  });
}

export async function authenticateMcpRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const accessToken = authorization.slice(7).trim();
  if (!accessToken || accessToken.includes(" ")) return null;

  const supabase = createWorkspaceBearerClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;
  const claims = decodeClaims(accessToken);
  const audience = claims?.aud;
  const intendedAudience = workspaceMcpResourceUri();
  const audienceMatches = typeof audience === "string" ? audience === intendedAudience : Array.isArray(audience) && audience.includes(intendedAudience);
  if (!claims || claims.sub !== data.user.id || !audienceMatches || claims.workspace_mcp !== true || typeof claims.client_id !== "string" || !claims.client_id) return null;
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) return null;
  return { accessToken, user: data.user, claims, supabase };
}

function decodeClaims(accessToken: string): Record<string, unknown> | null {
  try {
    const segment = accessToken.split(".")[1];
    if (!segment) return null;
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}
