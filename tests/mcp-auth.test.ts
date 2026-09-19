import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createWorkspaceBearerClient: () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc
  }),
  workspaceSupabaseUrl: () => "https://shared-auth.example.test"
}));

import { authenticateMcpRequest } from "@/lib/workspace/mcp-auth";

const userId = "61111111-1111-4111-8111-111111111111";
const resource = "https://workspace.leademergence.com/api/mcp";
const canonicalClaims = {
  sub: userId,
  role: "authenticated",
  iss: "https://shared-auth.example.test/auth/v1",
  session_id: "62222222-2222-4222-8222-222222222222",
  client_id: "6c111111-1111-4111-8111-111111111111",
  le_session_class: "mcp_oauth",
  le_product: "workspace",
  le_binding_version: 1,
  aud: resource,
  resource,
  workspace_mcp: true,
  iat: Math.floor(Date.now() / 1000) - 30,
  exp: Math.floor(Date.now() / 1000) + 300
};

function bearerRequest(claims: Record<string, unknown>) {
  const token = ["e30", Buffer.from(JSON.stringify(claims)).toString("base64url"), "signature"].join(".");
  return new Request(resource, { headers: { authorization: `Bearer ${token}` } });
}

describe("Workspace MCP bearer verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.WORKSPACE_MCP_RESOURCE_URI;
    delete process.env.NEXT_PUBLIC_APP_URL;
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
  });

  it("admits canonical claims only after the database agrees", async () => {
    const result = await authenticateMcpRequest(bearerRequest(canonicalClaims));

    expect(result?.user.id).toBe(userId);
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("mcp_verify_current_authority");
  });

  it("rejects the legacy claim subset before querying Workspace authority", async () => {
    const result = await authenticateMcpRequest(bearerRequest({
      sub: userId,
      client_id: canonicalClaims.client_id,
      aud: resource,
      workspace_mcp: true,
      exp: canonicalClaims.exp
    }));

    expect(result).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["durable binding or local grant is absent", { data: false, error: null }],
    ["authority lookup fails", { data: null, error: { message: "denied" } }]
  ])("rejects when %s", async (_name, authorityResult) => {
    mocks.rpc.mockResolvedValue(authorityResult);

    await expect(authenticateMcpRequest(bearerRequest(canonicalClaims))).resolves.toBeNull();
  });
});
