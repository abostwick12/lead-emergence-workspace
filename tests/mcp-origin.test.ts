import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import * as mcpServer from "@/lib/workspace/mcp-server";
import * as sotfStore from "@/lib/sotf/server";

import { OPTIONS, POST } from "@/app/api/mcp/route";
import { isMcpCorsOrigin, isMcpRequestOriginAllowed } from "@/lib/workspace/mcp-origin";

describe("Lewis MCP origin policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
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

  it.each(["true", "false", undefined])("publishes static OAuth discovery with SOTF release flag %s", async (flag) => {
    vi.stubEnv("SOTF_PILOT_ENABLED", flag);
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
    const sotfTools = payload.result.tools.filter((tool) => tool.name.startsWith("sotf_"));
    if (flag === "true") {
      expect(sotfTools.map((tool) => tool.name).sort()).toEqual([
        "sotf_prepare_next_move", "sotf_record_transition_step", "sotf_resume_transition",
      ]);
      for (const tool of sotfTools) {
        expect(tool.securitySchemes).toEqual([
          { type: "oauth2", scopes: ["openid", "email", "profile"] },
        ]);
        expect(tool.outputSchema?.type).toBe("object");
      }
    } else {
      expect(sotfTools).toEqual([]);
    }
  });

  it.each(["get_onboarding_state", "sotf_resume_transition", "sotf_record_transition_step"])("challenges anonymous %s before creating a server or invoking its store", async (name) => {
    vi.stubEnv("SOTF_PILOT_ENABLED", "true");
    const createServer = vi.spyOn(mcpServer, "createWorkspaceMcpServer");
    const createStore = vi.spyOn(sotfStore, "createSotfStore");
    const response = await POST(new Request("https://workspace.leademergence.com/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "request-1", method: "tools/call", params: { name, arguments: {} } }),
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as { id: string; result: { isError: boolean; _meta: { "mcp/www_authenticate": string[] } } };
    expect(createServer).not.toHaveBeenCalled();
    expect(createStore).not.toHaveBeenCalled();
    expect(payload.id).toBe("request-1");
    expect(payload.result.isError).toBe(true);
    expect(payload.result._meta["mcp/www_authenticate"][0]).toContain('error="invalid_token"');
    expect(payload.result._meta["mcp/www_authenticate"][0]).toContain('error_description="Workspace authentication is required"');
  });
});
