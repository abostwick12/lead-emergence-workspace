import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { rpc, verifyOwner, readAttempt } = vi.hoisted(() => ({ rpc: vi.fn(), verifyOwner: vi.fn(), readAttempt: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
vi.mock("@/lib/integrations/server", () => ({ verifyWorkspaceOwner: verifyOwner }));
vi.mock("@/lib/calendar/credentials", async (importOriginal) => ({
  ...await importOriginal<typeof import("../lib/calendar/credentials")>(),
  readCalendarAttemptToken: readAttempt
}));

import { NextRequest } from "next/server";
import {
  CALENDAR_SCOPES, calendarApplicationOrigin, createCalendarFlow, exchangeAndVerifyCalendarCode,
  finishCalendarAccount, readCalendarFlow, revokeCalendarAccount, storeCalendarAttempt
} from "../lib/calendar/oauth";
import { decryptIntegrationValue } from "../lib/integrations/crypto";
import { GET as callback } from "../app/api/calendar/accounts/[slot]/callback/route";
import { POST as start, DELETE as disconnect } from "../app/api/calendar/accounts/[slot]/route";

const workspaceId = "caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const stateSecret = "calendar-state-secret-that-is-long-enough-to-test";
const encryptionSecret = "calendar-vault-secret-that-is-long-enough-to-test";

function googleResponse(slot: "personal" | "business", overrides: Record<string, unknown> = {}) {
  const email = slot === "personal" ? "andrew.w.bostwick12@gmail.com" : "andrew@leademergence.com";
  return vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({
      access_token: "synthetic-access", refresh_token: "synthetic-refresh",
      scope: CALENDAR_SCOPES.join(" "), expires_in: 3600,
      ...overrides
    }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ sub: `synthetic-${slot}-subject`, email, email_verified: true }), { status: 200 }));
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://workspace.example.test";
  process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_ID = "synthetic-client";
  process.env.WORKSPACE_GOOGLE_OAUTH_CLIENT_SECRET = "synthetic-secret";
  process.env.WORKSPACE_INTEGRATION_STATE_SECRET = stateSecret;
  process.env.WORKSPACE_INTEGRATION_ENCRYPTION_KEY = encryptionSecret;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic-anon-key";
  rpc.mockResolvedValue({ error: null });
  verifyOwner.mockResolvedValue(undefined);
  readAttempt.mockResolvedValue("synthetic-session");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  rpc.mockReset();
  verifyOwner.mockReset();
  readAttempt.mockReset();
});

describe("two-account Calendar OAuth", () => {
  it("accepts only a secure application origin or local HTTP", () => {
    for (const invalid of [
      "ftp://localhost", "http://workspace.example.test", "https://user:pass@workspace.example.test",
      "https://workspace.example.test/path", "https://workspace.example.test/?redirect=other"
    ]) {
      process.env.NEXT_PUBLIC_APP_URL = invalid;
      expect(() => calendarApplicationOrigin()).toThrow("application origin");
    }
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(calendarApplicationOrigin()).toBe("http://localhost:3000");
  });

  it("binds state, PKCE and redirect to the selected slot", () => {
    const personal = createCalendarFlow({ slot: "personal", workspaceId });
    const url = new URL(personal.authorizationUrl);
    expect(url.pathname).toBe("/o/oauth2/v2/auth");
    expect(url.searchParams.get("redirect_uri")).toBe("https://workspace.example.test/api/calendar/accounts/personal/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")?.split(" ")).toEqual([...CALENDAR_SCOPES]);
    expect(readCalendarFlow(personal.sealedFlow, "personal", url.searchParams.get("state")!).workspaceId).toBe(workspaceId);
    expect(() => readCalendarFlow(personal.sealedFlow, "business", url.searchParams.get("state")!)).toThrow();
    expect(() => readCalendarFlow(personal.sealedFlow, "personal", "wrong-state")).toThrow();
    expect(() => readCalendarFlow(`${personal.sealedFlow}tampered`, "personal", url.searchParams.get("state")!)).toThrow();
    const browserFlow = decryptIntegrationValue(personal.sealedFlow, stateSecret, "workspace-calendar-oauth-flow");
    expect(browserFlow).not.toContain("synthetic-session");
    expect(JSON.parse(browserFlow)).not.toHaveProperty("accessToken");
  });

  it("rejects an expired request", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const flow = createCalendarFlow({ slot: "business", workspaceId });
    const state = new URL(flow.authorizationUrl).searchParams.get("state")!;
    vi.spyOn(Date, "now").mockReturnValue(now + 10 * 60 * 1000 + 1);
    expect(() => readCalendarFlow(flow.sealedFlow, "business", state)).toThrow("expired");
  });

  it("requires the exact verified Google account, refresh token, and every scope", async () => {
    const flow = readCalendarFlow(...(() => {
      const item = createCalendarFlow({ slot: "personal", workspaceId });
      return [item.sealedFlow, "personal", new URL(item.authorizationUrl).searchParams.get("state")!] as const;
    })());
    vi.stubGlobal("fetch", googleResponse("business"));
    await expect(exchangeAndVerifyCalendarCode({ code: "synthetic-code", flow })).rejects.toThrow("does not match");
    vi.stubGlobal("fetch", googleResponse("personal", { refresh_token: undefined }));
    await expect(exchangeAndVerifyCalendarCode({ code: "synthetic-code", flow })).rejects.toThrow("required Calendar access");
    vi.stubGlobal("fetch", googleResponse("personal", { scope: "openid email" }));
    await expect(exchangeAndVerifyCalendarCode({ code: "synthetic-code", flow })).rejects.toThrow("required Calendar access");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "synthetic-access", refresh_token: "synthetic-refresh", scope: CALENDAR_SCOPES.join(" ") }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sub: "synthetic-subject", email: "andrew.w.bostwick12@gmail.com", email_verified: false }), { status: 200 })));
    await expect(exchangeAndVerifyCalendarCode({ code: "synthetic-code", flow })).rejects.toThrow("does not match");
  });

  it("saves separate encrypted slot credentials and revokes only the selected slot", async () => {
    for (const slot of ["personal", "business"] as const) {
      const item = createCalendarFlow({ slot, workspaceId });
      const flow = readCalendarFlow(item.sealedFlow, slot, new URL(item.authorizationUrl).searchParams.get("state")!);
      await storeCalendarAttempt({ accessToken: "synthetic-session", workspaceId, slot, stateHash: item.stateHash });
      vi.stubGlobal("fetch", googleResponse(slot));
      const credential = await exchangeAndVerifyCalendarCode({ code: `synthetic-${slot}-code`, flow });
      await finishCalendarAccount({ accessToken: "synthetic-session", workspaceId, slot, stateHash: item.stateHash, ...credential });
    }
    expect(rpc).toHaveBeenCalledTimes(4);
    expect(rpc.mock.calls[0][0]).toBe("start_owner_calendar_oauth_attempt");
    expect(String(rpc.mock.calls[0][1].p_ciphertext)).not.toContain("synthetic-session");
    expect(rpc.mock.calls[1][0]).toBe("finish_owner_calendar_oauth_attempt");
    const first = rpc.mock.calls[1][1] as Record<string, unknown>;
    const second = rpc.mock.calls[3][1] as Record<string, unknown>;
    expect(first.p_account_slot).toBe("personal");
    expect(second.p_account_slot).toBe("business");
    expect(first.p_ciphertext).not.toBe(second.p_ciphertext);
    expect(String(first.p_ciphertext)).not.toContain("synthetic-refresh");
    await revokeCalendarAccount("synthetic-session", workspaceId, "personal");
    expect(rpc).toHaveBeenLastCalledWith("revoke_owner_calendar_credential", { p_workspace_id: workspaceId, p_account_slot: "personal" });
  });

  it("rejects non-owner start and disconnect before any credential change", async () => {
    verifyOwner.mockRejectedValue(new Error("not owner"));
    const headers = { Authorization: "Bearer synthetic-session", "Content-Type": "application/json" };
    const request = () => new NextRequest("https://workspace.example.test/api/calendar/accounts/personal", {
      method: "POST", headers, body: JSON.stringify({ workspaceId })
    });
    expect((await start(request(), { params: Promise.resolve({ slot: "personal" }) })).status).toBe(400);
    expect((await disconnect(request(), { params: Promise.resolve({ slot: "personal" }) })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("saves only once when Google rejects a replayed authorization code", async () => {
    const item = createCalendarFlow({ slot: "personal", workspaceId });
    const state = new URL(item.authorizationUrl).searchParams.get("state")!;
    const url = `https://untrusted.example.test/api/calendar/accounts/personal/callback?code=synthetic-code&state=${state}`;
    const request = () => new NextRequest(url, { headers: { Cookie: `workspace_calendar_oauth=${item.sealedFlow}` } });
    const google = googleResponse("personal");
    google.mockResolvedValueOnce(new Response("{}", { status: 400 }));
    vi.stubGlobal("fetch", google);
    const first = await callback(request(), { params: Promise.resolve({ slot: "personal" }) });
    expect(first.headers.get("location")).toBe("https://workspace.example.test/workspace/integrations?calendar=personal&status=connected");
    expect((await callback(request(), { params: Promise.resolve({ slot: "personal" }) })).headers.get("location")).toContain("status=error");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("reports an error if disconnect invalidates the pending attempt before finish", async () => {
    const item = createCalendarFlow({ slot: "personal", workspaceId });
    const state = new URL(item.authorizationUrl).searchParams.get("state")!;
    const url = `https://workspace.example.test/api/calendar/accounts/personal/callback?code=synthetic-code&state=${state}`;
    vi.stubGlobal("fetch", googleResponse("personal"));
    rpc.mockImplementation(async (name: string) => ({ error: name === "finish_owner_calendar_oauth_attempt"
      ? { message: "This Calendar connection request has expired." } : null }));
    const response = await callback(new NextRequest(url, {
      headers: { Cookie: `workspace_calendar_oauth=${item.sealedFlow}` }
    }), { params: Promise.resolve({ slot: "personal" }) });
    expect(response.headers.get("location")).toContain("status=error");
    expect(rpc).toHaveBeenCalledWith("finish_owner_calendar_oauth_attempt", expect.objectContaining({
      p_account_slot: "personal", p_state_hash: item.stateHash
    }));
  });
});
