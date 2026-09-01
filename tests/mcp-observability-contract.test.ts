import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("app/api/mcp/route.ts", "utf8");
const server = readFileSync("lib/workspace/mcp-server.ts", "utf8");

describe("MCP runtime observability contract", () => {
  it("records only allowlisted lifecycle events after bearer authentication", () => {
    expect(route).toMatch(/authenticateMcpRequest\(request\)/);
    expect(route).toMatch(/recordMcpEvent\(authenticated\.supabase, "token_admitted"\)/);
    expect(route).toMatch(/"connection_registered"/);
    expect(route).toMatch(/"transport_initialized"/);
    expect(route).toMatch(/"tools_list_completed"/);
  });

  it("does not log or classify tool arguments", () => {
    expect(route).not.toMatch(/console\.(log|info|debug)/);
    expect(route).toMatch(/\["initialize", "tools\/list"\]/);
  });

  it("attempts official OAuth grant revocation only after the private disconnect boundary", () => {
    expect(server).toMatch(/mcp_disconnect_current_assistant/);
    expect(server).toMatch(/mcp_disconnect_assistant_connection/);
    expect(server).toMatch(/supabase\.auth\.oauth\.revokeGrant\(\{ clientId \}\)/);
    expect(server).toMatch(/provider_grant_revoked/);
    expect(server).toMatch(/the private grant and Workspace authorization are revoked atomically/i);
  });
});
