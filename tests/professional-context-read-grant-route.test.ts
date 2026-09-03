import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createWorkspaceServerClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
    from: mocks.from,
  })),
}));

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/workspace/professional-context/read-grants/route";
import { professionalContextCsrfCookie } from "@/lib/workspace/professional-context-security";

const csrfToken = "c".repeat(43);
const endpoint = "http://localhost:3000/api/workspace/professional-context/read-grants";

function authorizationQuery() {
  const result = Promise.resolve({
    data: [{
      id: "b1cc1111-1111-4111-8111-111111111111",
      client_id: "workspace-client-123",
      assistant_provider: "chatgpt",
    }],
    error: null,
  });
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(() => result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function request(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new NextRequest(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${professionalContextCsrfCookie}=${csrfToken}`,
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("Professional Context protected-read route", () => {
  beforeEach(() => {
    mocks.getUser.mockReset().mockResolvedValue({
      data: { user: { id: "b1111111-1111-4111-8111-111111111111" } },
      error: null,
    });
    mocks.rpc.mockReset().mockImplementation((name: string) => Promise.resolve({
      data: name === "list_professional_context_read_grants" ? { grants: [] } : { status: "active" },
      error: null,
    }));
    mocks.from.mockReset().mockImplementation(() => authorizationQuery());
  });

  it("loads canonical connection state through a cookie-backed direct session", async () => {
    const response = await GET(new NextRequest(endpoint));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.connections).toEqual([expect.objectContaining({
      clientId: "workspace-client-123",
      assistantProvider: "chatgpt",
    })]);
    expect(body.csrfToken).toHaveLength(43);
    expect(mocks.getUser).toHaveBeenCalledOnce();
  });

  it("allows the authenticated direct owner to create only the requested scope", async () => {
    const response = await POST(request({
      action: "grant",
      clientId: "workspace-client-123",
      privacyScope: "private",
      csrfToken,
    }));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("create_professional_context_read_grant", {
      target_client_id: "workspace-client-123",
      target_privacy_scope: "private",
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith("create_professional_context_read_grant", expect.objectContaining({
      target_privacy_scope: "sensitive",
    }));
  });

  it("revokes by the server-owned grant identifier and reloads authoritative state", async () => {
    const grantId = "b1000000-0000-4000-8000-000000000001";
    const response = await POST(request({ action: "revoke", grantId, csrfToken }));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "revoke_professional_context_read_grant", {
      target_grant_id: grantId,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "list_professional_context_read_grants");
  });

  it.each([
    ["bearer authorization", { authorization: "Bearer token" }, csrfToken, 403],
    ["untrusted origin", { origin: "https://attacker.invalid" }, csrfToken, 403],
    ["invalid fetch context", { "sec-fetch-site": "cross-site" }, csrfToken, 403],
    ["invalid CSRF token", {}, "x".repeat(43), 403],
    ["non-JSON content", { "content-type": "text/plain" }, csrfToken, 415],
  ])("rejects %s before invoking a grant RPC", async (_name, headers, submittedToken, status) => {
    const response = await POST(request({
      action: "grant",
      clientId: "workspace-client-123",
      privacyScope: "private",
      csrfToken: submittedToken,
    }, headers));

    expect(response.status).toBe(status);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects supplied user identity instead of substituting it", async () => {
    const response = await POST(request({
      action: "grant",
      clientId: "workspace-client-123",
      privacyScope: "private",
      csrfToken,
      userId: "b1222222-2222-4222-8222-222222222222",
    }));

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects bearer authorization on state reads", async () => {
    const response = await GET(new NextRequest(endpoint, { headers: { authorization: "Bearer token" } }));
    expect(response.status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
