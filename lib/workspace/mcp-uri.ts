export function normalizeMcpResourceUri(value: string, production = process.env.NODE_ENV === "production") {
  const resource = new URL(value);
  if (resource.username || resource.password || resource.search || resource.hash || resource.pathname !== "/api/mcp") {
    throw new Error("Workspace MCP resource must be an exact credential-free /api/mcp URL.");
  }
  const localHttp = resource.protocol === "http:" && ["localhost", "127.0.0.1"].includes(resource.hostname);
  if (resource.protocol !== "https:" && (production || !localHttp)) {
    throw new Error("Workspace MCP resource must use HTTPS outside loopback development.");
  }
  return resource.toString();
}

export function configuredMcpResourceUri(input = {
  configured: process.env.WORKSPACE_MCP_RESOURCE_URI?.trim(),
  applicationOrigin: process.env.NEXT_PUBLIC_APP_URL?.trim(),
  production: process.env.NODE_ENV === "production"
}) {
  if (input.configured) return normalizeMcpResourceUri(input.configured, input.production);
  if (input.production) throw new Error("WORKSPACE_MCP_RESOURCE_URI must be configured in production.");
  if (!input.applicationOrigin) throw new Error("WORKSPACE_MCP_RESOURCE_URI or NEXT_PUBLIC_APP_URL must be configured.");
  return normalizeMcpResourceUri(new URL("/api/mcp", input.applicationOrigin).toString(), false);
}
