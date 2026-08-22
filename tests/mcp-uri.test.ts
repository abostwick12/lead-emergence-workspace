import { describe, expect, it } from "vitest";
import { normalizeMcpResourceUri } from "@/lib/workspace/mcp-uri";

describe("Workspace MCP resource URI", () => {
  it("accepts only the exact production HTTPS endpoint", () => {
    expect(normalizeMcpResourceUri("https://workspace.leademergence.com/api/mcp", true)).toBe("https://workspace.leademergence.com/api/mcp");
    expect(() => normalizeMcpResourceUri("http://workspace.leademergence.com/api/mcp", true)).toThrow();
    expect(() => normalizeMcpResourceUri("https://workspace.leademergence.com/api/mcp?token=value", true)).toThrow();
    expect(() => normalizeMcpResourceUri("https://user:secret@workspace.leademergence.com/api/mcp", true)).toThrow();
    expect(() => normalizeMcpResourceUri("https://workspace.leademergence.com/other", true)).toThrow();
  });

  it("allows HTTP only for loopback development", () => {
    expect(normalizeMcpResourceUri("http://localhost:3000/api/mcp", false)).toBe("http://localhost:3000/api/mcp");
    expect(normalizeMcpResourceUri("http://127.0.0.1:3000/api/mcp", false)).toBe("http://127.0.0.1:3000/api/mcp");
    expect(() => normalizeMcpResourceUri("http://preview.example.test/api/mcp", false)).toThrow();
  });
});
