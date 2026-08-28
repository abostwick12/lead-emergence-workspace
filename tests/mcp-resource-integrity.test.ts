import { describe, expect, it } from "vitest";
import { configuredMcpResourceUri } from "@/lib/workspace/mcp-uri";

describe("Workspace MCP resource configuration", () => {
  it("uses the explicitly configured resource URI", () => {
    expect(configuredMcpResourceUri({ configured: "https://beta.workspace.example/api/mcp", applicationOrigin: "https://ignored.example", production: true })).toBe("https://beta.workspace.example/api/mcp");
  });

  it("fails closed when production omits the canonical resource URI", () => {
    expect(() => configuredMcpResourceUri({ configured: undefined, applicationOrigin: "https://workspace.example", production: true })).toThrow("WORKSPACE_MCP_RESOURCE_URI");
  });

  it("rejects malformed configured resources", () => {
    expect(() => configuredMcpResourceUri({ configured: "https://workspace.example/other", applicationOrigin: undefined, production: true })).toThrow();
  });
});