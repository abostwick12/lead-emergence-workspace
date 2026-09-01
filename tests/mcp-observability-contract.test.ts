import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("app/api/mcp/route.ts", "utf8");

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
});
