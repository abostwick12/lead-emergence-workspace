import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, product, details, approve, deny, planResult, capabilityResult } = vi.hoisted(() => ({
  createClient: vi.fn(), product: vi.fn(), details: vi.fn(), approve: vi.fn(), deny: vi.fn(),
  planResult: vi.fn(), capabilityResult: vi.fn()
}));
vi.mock("@/lib/supabase/server", () => ({ createWorkspaceServerClient: createClient }));

import { GET, POST } from "@/app/api/oauth/consent/route";

const authorizationId = "a".repeat(32);
const endpoint = "https://workspace.leademergence.com/api/oauth/consent";

function client() {
  const table = (name: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      single: async () => name === "personal_plans" ? planResult() : capabilityResult()
    };
    return query;
  };
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      oauth: { getAuthorizationDetails: details, approveAuthorization: approve, denyAuthorization: deny }
    },
    rpc: (name: string) => name === "ensure_personal_workspace"
      ? { single: async () => ({ data: { id: "workspace-1", owner_user_id: "user-1", workspace_type: "personal" }, error: null }) }
      : product(name),
    from: table
  };
}

describe("Workspace product-local consent", () => {
  beforeEach(() => {
    createClient.mockReset().mockImplementation(async () => client());
    product.mockReset(); details.mockReset(); approve.mockReset(); deny.mockReset();
    planResult.mockReset().mockReturnValue({ data: { plan_key: "personal", status: "active" }, error: null });
    capabilityResult.mockReset().mockReturnValue({ data: { enabled: true }, error: null });
  });

  it.each(["ministry", "consulting", "deny"])("blocks %s before details retrieval", async (value) => {
    product.mockResolvedValue({ data: value, error: null });
    expect((await GET(new Request(`${endpoint}?authorization_id=${authorizationId}`))).status).toBe(403);
    expect(details).not.toHaveBeenCalled();
  });

  it.each(["ministry", "consulting", "deny"])("blocks %s before approval", async (value) => {
    product.mockResolvedValue({ data: value, error: null });
    const response = await POST(new Request(endpoint, { method: "POST", body: JSON.stringify({ authorizationId, decision: "approve", product: "workspace" }) }));
    expect(response.status).toBe(403);
    expect(approve).not.toHaveBeenCalled();
  });

  it.each(["ministry", "consulting", "deny"])("blocks %s before denial", async (value) => {
    product.mockResolvedValue({ data: value, error: null });
    const response = await POST(new Request(endpoint, { method: "POST", body: JSON.stringify({ authorizationId, decision: "deny" }) }));
    expect(response.status).toBe(403);
    expect(deny).not.toHaveBeenCalled();
  });

  it("fails closed on missing or malformed IDs and a forged cross-origin decision", async () => {
    expect((await GET(new Request(`${endpoint}?authorization_id=bad`))).status).toBe(403);
    const response = await POST(new Request(endpoint, { method: "POST", headers: { origin: "https://attacker.example" }, body: JSON.stringify({ authorizationId, decision: "approve" }) }));
    expect(response.status).toBe(403);
    expect(product).not.toHaveBeenCalled();
  });

  it("rejects a null decision body without a server error", async () => {
    const response = await POST(new Request(endpoint, { method: "POST", body: "null" }));
    expect(response.status).toBe(400);
    expect(approve).not.toHaveBeenCalled();
  });

  it("uses the authenticated Workspace authority before a valid decision", async () => {
    product.mockResolvedValue({ data: "workspace", error: null });
    details.mockResolvedValue({ data: { authorization_id: authorizationId, client: { id: "client-1" } }, error: null });
    approve.mockResolvedValue({ data: { redirect_url: "https://client.example/callback" }, error: null });
    expect((await GET(new Request(`${endpoint}?authorization_id=${authorizationId}`))).status).toBe(200);
    expect((await POST(new Request(endpoint, { method: "POST", body: JSON.stringify({ authorizationId, decision: "approve" }) }))).status).toBe(200);
    expect(approve).toHaveBeenCalledTimes(1);
  });

  it("offers a safe exit for a verified Workspace request without active plan access", async () => {
    product.mockResolvedValue({ data: "workspace", error: null });
    planResult.mockReturnValue({ data: { plan_key: "personal", status: "suspended" }, error: null });
    const detailsResponse = await GET(new Request(`${endpoint}?authorization_id=${authorizationId}`));
    expect(detailsResponse.status).toBe(403);
    expect((await detailsResponse.json()).canLeave).toBe(true);
    expect(details).not.toHaveBeenCalled();
    expect(deny).not.toHaveBeenCalled();
  });

  it("allows a verified, associated Workspace request to be denied", async () => {
    product.mockResolvedValue({ data: "workspace", error: null });
    details.mockResolvedValue({ data: { authorization_id: authorizationId, client: { id: "client-1" } }, error: null });
    deny.mockResolvedValue({ data: { redirect_url: "https://client.example/callback" }, error: null });
    expect((await GET(new Request(`${endpoint}?authorization_id=${authorizationId}`))).status).toBe(200);
    expect((await POST(new Request(endpoint, { method: "POST", body: JSON.stringify({ authorizationId, decision: "deny" }) }))).status).toBe(200);
    expect(deny).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["suspended", true],
    ["active", false]
  ])("rejects approval when plan is %s and workspace_mcp is %s", async (status, enabled) => {
    product.mockResolvedValue({ data: "workspace", error: null });
    planResult.mockReturnValue({ data: { plan_key: "personal", status }, error: null });
    capabilityResult.mockReturnValue({ data: { enabled }, error: null });
    const response = await POST(new Request(endpoint, { method: "POST", body: JSON.stringify({ authorizationId, decision: "approve" }) }));
    expect(response.status).toBe(403);
    expect(approve).not.toHaveBeenCalled();
  });

  it("checks the active plan before an authorization-details call that could auto-approve", async () => {
    product.mockResolvedValue({ data: "workspace", error: null });
    planResult.mockReturnValue({ data: { plan_key: "personal", status: "suspended" }, error: null });
    expect((await GET(new Request(`${endpoint}?authorization_id=${authorizationId}`))).status).toBe(403);
    expect(details).not.toHaveBeenCalled();
  });
});
