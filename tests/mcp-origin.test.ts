import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { OPTIONS } from "@/app/api/mcp/route";
import { isMcpCorsOrigin, isMcpRequestOriginAllowed } from "@/lib/workspace/mcp-origin";

describe("Lewis MCP origin policy", () => {
  it("allows server-to-server requests without Origin", () => {
    expect(isMcpRequestOriginAllowed(null)).toBe(true);
  });

  it.each(["https://chatgpt.com", "https://claude.ai", "https://www.claude.ai", "https://workspace.leademergence.com"])("allows supported browser origins: %s", (origin) => {
    expect(isMcpRequestOriginAllowed(origin)).toBe(true);
    expect(isMcpCorsOrigin(origin)).toBe(true);
  });

  it.each(["https://evil.example", "https://chatgpt.com.evil.example", "null"])("rejects an untrusted supplied origin: %s", (origin) => {
    expect(isMcpRequestOriginAllowed(origin)).toBe(false);
    expect(isMcpCorsOrigin(origin)).toBe(false);
  });

  it("rejects an untrusted browser origin at the MCP route without reflecting it", async () => {
    const response = OPTIONS(new Request("https://workspace.leademergence.com/api/mcp", { headers: { origin: "https://evil.example" } }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "origin_not_allowed" });
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns a narrow CORS preflight for a supported browser origin", () => {
    const response = OPTIONS(new Request("https://workspace.leademergence.com/api/mcp", { headers: { origin: "https://chatgpt.com" } }));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://chatgpt.com");
  });
});
