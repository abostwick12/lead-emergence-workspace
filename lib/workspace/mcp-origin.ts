const allowedOrigins = new Set([
  "https://chatgpt.com",
  "https://claude.ai",
  "https://www.claude.ai",
  "https://workspace.leademergence.com"
]);

// A missing Origin is valid for server-to-server MCP transports. Any supplied
// Origin must be one of the browser clients we explicitly support.
export function isMcpRequestOriginAllowed(origin: string | null) {
  return !origin || allowedOrigins.has(origin);
}

export function isMcpCorsOrigin(origin: string | null): origin is string {
  return origin !== null && allowedOrigins.has(origin);
}
