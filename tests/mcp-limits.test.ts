import { describe, expect, it } from "vitest";
import { MCP_MAX_REQUEST_BYTES, mcpRequestWithinBodyLimit } from "@/lib/workspace/mcp-limits";

describe("Workspace MCP request limits", () => {
  it("allows absent and bounded content lengths", () => {
    expect(mcpRequestWithinBodyLimit(null)).toBe(true);
    expect(mcpRequestWithinBodyLimit(String(MCP_MAX_REQUEST_BYTES))).toBe(true);
  });

  it("rejects malformed and oversized content lengths before request processing", () => {
    expect(mcpRequestWithinBodyLimit("not-a-number")).toBe(false);
    expect(mcpRequestWithinBodyLimit(String(MCP_MAX_REQUEST_BYTES + 1))).toBe(false);
  });
});