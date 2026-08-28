export const MCP_MAX_REQUEST_BYTES = 256 * 1024;
export const MCP_REQUESTS_PER_MINUTE = 60;

export function mcpRequestWithinBodyLimit(contentLength: string | null) {
  if (!contentLength) return true;
  const parsed = Number(contentLength);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= MCP_MAX_REQUEST_BYTES;
}