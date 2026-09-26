import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/oauth/consent-diagnostic/route";

const authGetUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createWorkspaceServerClient: async () => ({ auth: { getUser: authGetUser } }),
}));

const url = "https://workspace.leademergence.com/api/oauth/consent-diagnostic";
const attempt_id = "eea036f4-1c09-40c3-9314-81feb374ad28";
const client_id = "30924308-553d-4f75-946a-e12c61567fa5";
const user_id = "2e19ed32-c317-4763-83a7-cc18a4380df5";

function request(payload: unknown, origin = "https://workspace.leademergence.com") {
  return new Request(url, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

beforeEach(() => authGetUser.mockResolvedValue({ data: { user: { id: user_id } }, error: null }));
afterEach(() => { vi.restoreAllMocks(); authGetUser.mockReset(); });

describe("OAuth consent diagnostics receiver", () => {
  it("emits correlated allowlisted stages that distinguish identity, approval, result, and redirect", async () => {
    const logged = vi.spyOn(console, "info").mockImplementation(() => {});
    const events = [
      { attempt_id, sequence: 0, client_id, stage: "allow_started" },
      { attempt_id, sequence: 1, client_id, stage: "approval_attempted" },
      { attempt_id, sequence: 2, client_id, stage: "approval_result", outcome: "success", redirect_kind: "authorization_code" },
      { attempt_id, sequence: 3, client_id, stage: "redirect_selected", branch: "oauth_redirect" },
      { attempt_id, sequence: 2, client_id, stage: "approval_result", outcome: "error", error_code: "invalid_request", error_type: "AuthApiError", error_status: 400, redirect_kind: "missing" },
      { attempt_id, sequence: 3, client_id, stage: "redirect_selected", branch: "stay_on_error" },
      { attempt_id, sequence: 2, client_id, stage: "approval_exception", error_code: "unclassified", error_type: "TypeError" },
    ];
    for (const event of events) expect((await POST(request(event))).status).toBe(204);
    expect(logged.mock.calls).toEqual(events.map((event) => ["workspace_oauth_consent_diagnostic", { ...event, user_id }]));
  });

  it("rejects unauthenticated events and never trusts browser-supplied identity", async () => {
    const logged = vi.spyOn(console, "info").mockImplementation(() => {});
    const event = { attempt_id, sequence: 0, client_id, stage: "allow_started" };
    authGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await POST(request(event))).status).toBe(401);
    expect(logged).not.toHaveBeenCalled();
    expect((await POST(request({ ...event, user_id }))).status).toBe(400);
    expect((await POST(request({ ...event, identity: "present" }))).status).toBe(400);
    expect(logged).not.toHaveBeenCalled();
  });

  it("does not log or return session material from the authenticated request", async () => {
    const logged = vi.spyOn(console, "info").mockImplementation(() => {});
    const event = { attempt_id, sequence: 0, client_id, stage: "allow_started" };
    const response = await POST(new Request(url, {
      method: "POST",
      headers: { origin: "https://workspace.leademergence.com", "content-type": "application/json", cookie: "session=never-log-this-cookie" },
      body: JSON.stringify(event),
    }));
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.text()).toBe("");
    expect(JSON.stringify(logged.mock.calls)).not.toContain("never-log-this-cookie");
    expect(logged.mock.calls[0][1]).toEqual({ ...event, user_id });
  });

  it("rejects secrets, arbitrary payloads, and cross-origin submissions without logging", async () => {
    const logged = vi.spyOn(console, "info").mockImplementation(() => {});
    const base = { attempt_id, sequence: 1, client_id, stage: "approval_attempted" };
    for (const key of ["authorization_code", "access_token", "refresh_token", "cookie", "pkce_verifier", "password", "message", "redirect_url"]) {
      expect((await POST(request({ ...base, [key]: "secret" }))).status).toBe(400);
    }
    expect((await POST(request({ ...base, error_code: "Bearer secret" }))).status).toBe(400);
    expect((await POST(request(base, "https://other.example"))).status).toBe(403);
    expect(logged).not.toHaveBeenCalled();
  });

  it("rejects malformed stage combinations and oversized bodies", async () => {
    const logged = vi.spyOn(console, "info").mockImplementation(() => {});
    expect((await POST(request({ attempt_id, sequence: 2, stage: "approval_result", outcome: "error", redirect_kind: "missing" }))).status).toBe(400);
    expect((await POST(request({ attempt_id, sequence: 2, stage: "approval_result", outcome: "success", redirect_kind: "other", error_code: "invalid_request" }))).status).toBe(400);
    expect((await POST(request({ attempt_id, sequence: 0, stage: "unknown" }))).status).toBe(400);
    expect((await POST(request({ attempt_id, sequence: 0, stage: "__proto__" }))).status).toBe(400);
    expect((await POST(request({ attempt_id, sequence: 2, stage: "allow_started" }))).status).toBe(400);
    expect((await POST(request({ attempt_id, sequence: 0, stage: "allow_started", padding: "x".repeat(600) }))).status).toBe(413);
    expect(logged).not.toHaveBeenCalled();
  });
});

describe("existing consent behavior boundary", () => {
  const page = readFileSync("app/oauth/consent/page.tsx", "utf8");

  it("keeps the existing Supabase approval and denial calls and does not add a completion call", () => {
    expect(page).toContain("approveAuthorization(details.authorization_id, { skipBrowserRedirect: true })");
    expect(page).toContain("denyAuthorization(details.authorization_id, { skipBrowserRedirect: true })");
    expect(page).not.toContain("complete_mcp_oauth_authorization");
  });

  it("keeps the existing redirect destinations and safety predicate", () => {
    expect(page).toContain("window.location.assign(result.data.redirect_url)");
    expect(page).toContain("window.location.replace(authorization.data.redirect_url)");
    expect(page).toContain("window.location.replace(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`)");
    expect(page).toContain("result.error || !result.data?.redirect_url || !safeOAuthRedirect(result.data.redirect_url)");
  });
});
