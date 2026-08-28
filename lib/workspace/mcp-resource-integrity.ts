import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { configuredMcpResourceUri, normalizeMcpResourceUri } from "@/lib/workspace/mcp-uri";

export async function assertMcpResourceIntegrity(supabase: SupabaseClient<any, any, any, any, any>) {
  const runtimeResource = configuredMcpResourceUri();
  const { data, error } = await supabase.rpc("mcp_get_resource_configuration");
  if (error || !data || typeof data !== "object" || typeof data.resource_uri !== "string") {
    throw new Error("Workspace MCP resource configuration is unavailable.");
  }
  const persistedResource = normalizeMcpResourceUri(data.resource_uri);
  if (persistedResource !== runtimeResource) {
    throw new Error("Workspace MCP resource configuration does not match this deployment.");
  }
  return runtimeResource;
}