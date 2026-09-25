import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/oauth/consent-diagnostic/route";

const url = "https://workspace.leademergence.com/api/oauth/consent-diagnostic";
const attempt_id = "eea036f4-1c09-40c3-9314-81feb374ad28";
const client_id = "30924308-553d-4f75-946a-e12c61567fa5";

function request(payload: unknown, origin = "https://workspace.leademergence.com") {
  return new Request(url, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

afterEach(() => vi.restoreAllMocks());

describe("OAuth consent diagnostics receiver", () => {
  it("emits correlated allowlisted stages that distinguish identity, approval, result, and redirect", async () => {
    const logged = vi.spyOn(console, "info").mockImplementation(() => {});
    const events = [
      { attempt_id, stage: "identity_checked", identity: "present" },
      { attempt_id, stage: "identity_checked", identity: "absent" },
      { attempt_id, client_id, stage: "allow_started", identity: "present" },
      { attempt_id, client_id, stage: "approval_attempted" },
      { attempt_id, client_id, stage: "approval_result", outcome: "success", redirect_kind: "authorization_code" },
      { attempt_id, client_id, stage: "redirect_selected", branch: "oauth_redirect" },
      { attempt_id, client_id, stage: "approval_result", outcome: "error", error_code: "invalid_request", error_type: "AuthApiError", error_status: 400, redirect_kind: "missing" },
      { attempt_id, client_id, stage: "redirect_selected", branch: "stay_on_error" },
      { attempt_id, client_id, stage: "approval_exception", error_code: "unclassified", error_type: "TypeError" },
    ];
    for (const event of events) expect((await POST(request(event))).status).toBe(204);
    expect(logged.mock.calls).toEqual(events.map((event) => ["workspace_oauth_consent_diagnostic", event]));
  });

  it("rejects secrets, arbitrary payloads, and cross-origin submissions without logging", async () => {
    const logged = vi.spyOn(console, "info").mockImplementation(() => {});
    const base = { attempt_id, client_id, stage: "approval_attempted" };
    for (const key of ["authorization_code", "access_token", "refresh_token", "cookie", "pkce_verifier", "password", "message", "redirect_url"]) {
      expect((await POST(request({ ...base, [key]: "secret" }))).status).toBe(400);
    }
    expect((await POST(request({ ...base, error_code: "Bearer secret" }))).status).toBe(400);
    expect((await POST(request(base, "https://other.example"))).status).toBe(403);
    expect(logged).not.toHaveBeenCalled();
  });

  it("rejects malformed stage combinations and oversized bodies", async () => {
    const logged = vi.spyOn(console, "info").mockImplementation(() => {});
    expect((await POST(request({ attempt_id, stage: "approval_result", outcome: "error", redirect_kind: "missing" }))).status).toBe(400);
    expect((await POST(request({ attempt_id, stage: "approval_result", outcome: "success", redirect_kind: "other", error_code: "invalid_request" }))).status).toBe(400);
    expect((await POST(request({ attempt_id, stage: "unknown" }))).status).toBe(400);
    expect((await POST(request({ attempt_id, stage: "__proto__" }))).status).toBe(400);
    expect((await POST(request({ attempt_id, stage: "allow_started", identity: "present", padding: "x".repeat(600) }))).status).toBe(413);
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
