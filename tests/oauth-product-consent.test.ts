import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, product, details, approve, deny, completion, planResult, capabilityResult } = vi.hoisted(() => ({
  createClient: vi.fn(), product: vi.fn(), details: vi.fn(), approve: vi.fn(), deny: vi.fn(),
  completion: vi.fn(), planResult: vi.fn(), capabilityResult: vi.fn()
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
    rpc: (name: string, args?: Record<string, unknown>) => name === "ensure_personal_workspace"
      ? { single: async () => ({ data: { id: "workspace-1", owner_user_id: "user-1", workspace_type: "personal" }, error: null }) }
      : name === "complete_mcp_oauth_authorization" ? completion(args)
      : product(name),
    from: table
  };
}

describe("Workspace product-local consent", () => {
  beforeEach(() => {
    createClient.mockReset().mockImplementation(async () => client());
    product.mockReset(); details.mockReset(); approve.mockReset(); deny.mockReset();
    completion.mockReset().mockResolvedValue({ data: { status: "active", product_binding: "active" }, error: null });
    planResult.mockReset().mockReturnValue({ data: { plan_key: "personal", status: "active" }, error: null });
    capabilityResult.mockReset().mockReturnValue({ data: { enabled: true }, error: null });
  });

  it.each(["ministry", "consulting", "deny"])("blocks %s before details retrieval", async (value) => {
    product.mockResolvedValue({ data: value, error: null });
    expect((await GET(new Request(`${endpoint}?authorization_id=${authorizationId}`))).status).toBe(403);
    expect(details).not.toHaveBeenCalled();
    expect(completion).not.toHaveBeenCalled();
  });

  it.each(["ministry", "consulting", "deny"])("blocks %s before approval", async (value) => {
    product.mockResolvedValue({ data: value, error: null });
    const response = await POST(new Request(endpoint, { method: "POST", body: JSON.stringify({ authorizationId, decision: "approve", product: "workspace" }) }));
    expect(response.status).toBe(403);
    expect(approve).not.toHaveBeenCalled();
    expect(completion).not.toHaveBeenCalled();
  });

  it.each(["ministry", "consulting", "deny"])("blocks %s before denial", async (value) => {
    product.mockResolvedValue({ data: value, error: null });
    const response = await POST(new Request(endpoint, { method: "POST", body: JSON.stringify({ authorizationId, decision: "deny" }) }));
    expect(response.status).toBe(403);
    expect(deny).not.toHaveBeenCalled();
    expect(completion).not.toHaveBeenCalled();
  });

  it("fails closed on missing or malformed IDs and a forged cross-origin decision", async () => {
    expect((await GET(new Request(`${endpoint}?authorization_id=bad`))).status).toBe(403);
    const response = await POST(new Request(endpoint, { method: "POST", headers: { origin: "https://attacker.example" }, body: JSON.stringify({ authorizationId, decision: "approve" }) }));
    expect(response.status).toBe(403);
    expect(product).not.toHaveBeenCalled();
    expect(completion).not.toHaveBeenCalled();
  });

  it("rejects a null decision body without a server error", async () => {
    const response = await POST(new Request(endpoint, { method: "POST", body: "null" }));
    expect(response.status).toBe(400);
    expect(approve).not.toHaveBeenCalled();
    expect(completion).not.toHaveBeenCalled();
  });

  it("uses the authenticated Workspace authority before a valid decision", async () => {
    product.mockResolvedValue({ data: "workspace", error: null });
    details.mockResolvedValue({ data: { authorization_id: authorizationId, client: { id: "client-1" } }, error: null });
    approve.mockResolvedValue({ data: { redirect_url: "https://client.example/callback" }, error: null });
    expect((await GET(new Request(`${endpoint}?authorization_id=${authorizationId}`))).status).toBe(200);
    expect(completion).not.toHaveBeenCalled();
    const response = await POST(new Request(endpoint, { method: "POST", body: JSON.stringify({ authorizationId, decision: "approve" }) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirect_url: "https://client.example/callback" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(approve).toHaveBeenCalledTimes(1);
    expect(approve).toHaveBeenCalledWith(authorizationId, { skipBrowserRedirect: true });
    expect(completion).toHaveBeenCalledExactlyOnceWith({ p_authorization_id: authorizationId });
    expect(approve.mock.invocationCallOrder[0]).toBeLessThan(completion.mock.invocationCallOrder[0]);
  });

  it("completes an SDK auto-approved authorization before returning its redirect", async () => {
    product.mockResolvedValue({ data: "workspace", error: null });
    details.mockResolvedValue({ data: { redirect_url: "https://client.example/callback" }, error: null });
    const response = await GET(new Request(`${endpoint}?authorization_id=${authorizationId}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirect_url: "https://client.example/callback" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(completion).toHaveBeenCalledExactlyOnceWith({ p_authorization_id: authorizationId });
    expect(details.mock.invocationCallOrder[0]).toBeLessThan(completion.mock.invocationCallOrder[0]);
    expect(approve).not.toHaveBeenCalled();
  });

  it.each(["GET", "POST"])("withholds the %s redirect until completion finishes", async (method) => {
    product.mockResolvedValue({ data: "workspace", error: null });
    details.mockResolvedValue({ data: { redirect_url: "https://client.example/callback" }, error: null });
    approve.mockResolvedValue({ data: { redirect_url: "https://client.example/callback" }, error: null });
    let finish!: () => void;
    let entered!: () => void;
    const completionEntered = new Promise<void>((resolve) => { entered = resolve; });
    completion.mockImplementation(() => new Promise((resolve) => {
      finish = () => resolve({ data: { status: "active", product_binding: "active" }, error: null });
      entered();
    }));
    let returned = false;
    const response = (method === "GET"
      ? GET(new Request(`${endpoint}?authorization_id=${authorizationId}`))
      : POST(new Request(endpoint, { method: "POST", body: JSON.stringify({ authorizationId, decision: "approve" }) })))
      .then((result) => { returned = true; return result; });
    await completionEntered;
    expect(returned).toBe(false);
    finish();
    expect((await response).status).toBe(200);
    expect(completion).toHaveBeenCalledTimes(1);
  });

  it.each(["GET", "POST"])("fails closed on %s completion errors or incomplete authority", async (method) => {
    product.mockResolvedValue({ data: "workspace", error: null });
    details.mockResolvedValue({ data: { redirect_url: "https://client.example/callback" }, error: null });
    approve.mockResolvedValue({ data: { redirect_url: "https://client.example/callback" }, error: null });
    for (const result of [
      { data: null, error: { code: "42501" } },
      { data: null, error: null },
      { data: { status: "active" }, error: null },
      { data: { status: "inactive", product_binding: "active" }, error: null }
    ]) {
      completion.mockResolvedValueOnce(result);
      const response = method === "GET"
        ? await GET(new Request(`${endpoint}?authorization_id=${authorizationId}`))
        : await POST(new Request(endpoint, { method: "POST", body: JSON.stringify({ authorizationId, decision: "approve" }) }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "The authorization decision could not be completed safely." });
    }
    expect(completion).toHaveBeenCalledTimes(4);
  });

  it.each(["GET", "POST"])("does not complete a failed or unsafe %s SDK redirect", async (method) => {
    product.mockResolvedValue({ data: "workspace", error: null });
    for (const result of [
      { data: null, error: { message: "Authorization failed" } },
      { data: { redirect_url: "javascript:alert(1)" }, error: null }
    ]) {
      details.mockResolvedValueOnce(result);
      approve.mockResolvedValueOnce(result);
      const response = method === "GET"
        ? await GET(new Request(`${endpoint}?authorization_id=${authorizationId}`))
        : await POST(new Request(endpoint, { method: "POST", body: JSON.stringify({ authorizationId, decision: "approve" }) }));
      expect(response.status).toBe(400);
      expect((await response.json()).redirect_url).toBeUndefined();
    }
    expect(completion).not.toHaveBeenCalled();
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
    expect(completion).not.toHaveBeenCalled();
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
    expect(completion).not.toHaveBeenCalled();
  });

  it("checks the active plan before an authorization-details call that could auto-approve", async () => {
    product.mockResolvedValue({ data: "workspace", error: null });
    planResult.mockReturnValue({ data: { plan_key: "personal", status: "suspended" }, error: null });
    expect((await GET(new Request(`${endpoint}?authorization_id=${authorizationId}`))).status).toBe(403);
    expect(details).not.toHaveBeenCalled();
    expect(completion).not.toHaveBeenCalled();
  });
});
