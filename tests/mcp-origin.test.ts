import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { OPTIONS, POST } from "@/app/api/mcp/route";
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

  it("publishes static tool discovery without a bearer and retains top-level OAuth policy on the wire", async () => {
    const response = await POST(new Request("https://workspace.leademergence.com/api/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-protocol-version": "2025-11-25",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as { result: { tools: Array<{ name: string; securitySchemes?: unknown; outputSchema?: { type?: string } }> } };
    const onboarding = payload.result.tools.find((tool) => tool.name === "get_onboarding_state");
    expect(onboarding?.securitySchemes).toEqual([
      { type: "oauth2", scopes: ["openid", "email", "profile"] },
    ]);
    expect(onboarding?.outputSchema?.type).toBe("object");
  });

  it("returns the required OAuth challenge as a JSON-RPC tool result without a bearer", async () => {
    const response = await POST(new Request("https://workspace.leademergence.com/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "request-1", method: "tools/call", params: { name: "get_onboarding_state", arguments: {} } }),
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as { id: string; result: { isError: boolean; _meta: { "mcp/www_authenticate": string[] } } };
    expect(payload.id).toBe("request-1");
    expect(payload.result.isError).toBe(true);
    expect(payload.result._meta["mcp/www_authenticate"][0]).toContain('error="invalid_token"');
    expect(payload.result._meta["mcp/www_authenticate"][0]).toContain('error_description="Workspace authentication is required"');
  });
});
