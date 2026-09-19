import { describe, expect, it } from "vitest";
import { isCanonicalWorkspaceMcpClaims } from "@/lib/workspace/mcp-claims";

const userId = "61111111-1111-4111-8111-111111111111";
const resource = "https://workspace.leademergence.com/api/mcp";
const issuer = "https://shared-auth.example.test/auth/v1";
const nowMs = 2_000_000_000_000;

const validClaims = {
  sub: userId,
  role: "authenticated",
  iss: issuer,
  session_id: "62222222-2222-4222-8222-222222222222",
  client_id: "6c111111-1111-4111-8111-111111111111",
  le_session_class: "mcp_oauth",
  le_product: "workspace",
  le_binding_version: 1,
  aud: resource,
  resource,
  workspace_mcp: true,
  iat: 1_999_999_000,
  exp: 2_000_000_100
};

function accepts(claims: Record<string, unknown>) {
  return isCanonicalWorkspaceMcpClaims(claims, { userId, resource, issuer, nowMs });
}

describe("canonical Workspace MCP bearer claims", () => {
  it("accepts the exact Stage 2 product-bound contract", () => {
    expect(accepts(validClaims)).toBe(true);
  });

  it.each([
    ["legacy claim shape", { le_session_class: undefined, le_product: undefined, le_binding_version: undefined, resource: undefined, session_id: undefined, iss: undefined }],
    ["missing product", { le_product: undefined }],
    ["wrong product", { le_product: "consulting" }],
    ["missing session class", { le_session_class: undefined }],
    ["wrong session class", { le_session_class: "browser" }],
    ["missing binding version", { le_binding_version: undefined }],
    ["wrong binding version", { le_binding_version: 2 }],
    ["wrong audience", { aud: "https://wrong.example/api/mcp" }],
    ["audience array", { aud: [resource] }],
    ["wrong resource", { resource: "https://wrong.example/api/mcp" }],
    ["wrong issuer", { iss: "https://wrong.example/auth/v1" }],
    ["missing session", { session_id: undefined }],
    ["malformed session", { session_id: "not-a-uuid" }],
    ["subject mismatch", { sub: "63333333-3333-4333-8333-333333333333" }],
    ["malformed client", { client_id: "not-a-uuid" }],
    ["string Workspace marker", { workspace_mcp: "true" }],
    ["wrong role", { role: "service_role" }],
    ["missing issued-at", { iat: undefined }],
    ["expired token", { exp: 1_999_999_999 }]
  ])("rejects %s", (_name, replacement) => {
    expect(accepts({ ...validClaims, ...replacement })).toBe(false);
  });
});
