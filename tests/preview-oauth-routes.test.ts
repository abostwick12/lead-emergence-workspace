import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PREVIEW_ISSUER, PREVIEW_PROJECT_URL, PREVIEW_WORKSPACE_ORIGIN, PREVIEW_TRANSACTION_COOKIE } from "@/lib/auth/preview-oauth";

const fixture = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  auth: { getClaims: vi.fn(), setSession: vi.fn(), getUser: vi.fn(), signOut: vi.fn(), signInWithOAuth: vi.fn(), exchangeCodeForSession: vi.fn() },
  rpc: vi.fn()
}));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => fixture.jar.has(name) ? { value: fixture.jar.get(name) } : undefined,
  set: (name: string, value: string, options?: { maxAge?: number }) => {
    if (options?.maxAge === 0) fixture.jar.delete(name); else fixture.jar.set(name, value);
  }
}) }));
vi.mock("@/lib/supabase/server", () => ({ createWorkspaceServerClient: async () => ({ auth: fixture.auth, rpc: fixture.rpc }) }));
vi.mock("@/lib/http/origin", () => ({ trustedWorkspaceOrigin: () => PREVIEW_WORKSPACE_ORIGIN }));
import { GET as start } from "@/app/auth/entry/route";
import { GET as callback } from "@/app/auth/callback/sign-in/route";

const clientId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.clearAllMocks();
  fixture.jar.clear();
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("NEXT_PUBLIC_ENTRY_FIRST_PARTY_PREVIEW_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", PREVIEW_PROJECT_URL);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", PREVIEW_WORKSPACE_ORIGIN);
  vi.stubEnv("NEXT_PUBLIC_ENTRY_PREVIEW_CLIENT_ID", clientId);
  fixture.auth.getClaims.mockResolvedValue({ data: { claims: { sub: userId, iss: PREVIEW_ISSUER,
    aud: "authenticated", role: "authenticated", client_id: clientId,
    session_id: "33333333-3333-4333-8333-333333333333" } }, error: null });
  fixture.auth.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  fixture.auth.setSession.mockResolvedValue({ error: null });
  fixture.auth.signOut.mockResolvedValue({ error: null });
  fixture.rpc.mockResolvedValue({ error: null });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ access_token: "synthetic", refresh_token: "synthetic-refresh", token_type: "bearer" })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function begin() {
  const response = await start(new NextRequest(`${PREVIEW_WORKSPACE_ORIGIN}/auth/entry?next=/workspace/career`));
  const authorization = new URL(response.headers.get("location")!);
  return authorization.searchParams.get("state")!;
}

describe("Preview callback boundary", () => {
  it("consumes the transaction, verifies identity, and provisions only after installing the verified token", async () => {
    const state = await begin();
    const response = await callback(new NextRequest(`${PREVIEW_WORKSPACE_ORIGIN}/auth/callback/sign-in?code=synthetic&state=${state}`));
    expect(response.headers.get("location")).toBe(`${PREVIEW_WORKSPACE_ORIGIN}/workspace/career`);
    expect(fixture.jar.has(PREVIEW_TRANSACTION_COOKIE)).toBe(false);
    expect(fixture.auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(fixture.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(fixture.rpc).toHaveBeenCalledWith("ensure_personal_workspace");
    expect(fixture.auth.getClaims.mock.invocationCallOrder[0]).toBeLessThan(fixture.auth.setSession.mock.invocationCallOrder[0]);
    expect(fixture.auth.setSession.mock.invocationCallOrder[0]).toBeLessThan(fixture.rpc.mock.invocationCallOrder[0]);
  });
  it("rejects mismatched state before exchanging or provisioning", async () => {
    await begin();
    const response = await callback(new NextRequest(`${PREVIEW_WORKSPACE_ORIGIN}/auth/callback/sign-in?code=synthetic&state=wrong`));
    expect(response.headers.get("location")).toContain("error=entry_denied");
    expect(fetch).not.toHaveBeenCalled();
    expect(fixture.rpc).not.toHaveBeenCalled();
    expect(fixture.jar.has(PREVIEW_TRANSACTION_COOKIE)).toBe(false);
  });
  it("rejects replay after the first callback", async () => {
    const state = await begin();
    const request = new NextRequest(`${PREVIEW_WORKSPACE_ORIGIN}/auth/callback/sign-in?code=synthetic&state=${state}`);
    await callback(request);
    vi.mocked(fetch).mockClear();
    fixture.rpc.mockClear();
    const replay = await callback(request);
    expect(replay.headers.get("location")).toContain("error=entry_denied");
    expect(fetch).not.toHaveBeenCalled();
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it("rejects an Auth user different from the verified token subject", async () => {
    const state = await begin();
    fixture.auth.getUser.mockResolvedValue({ data: { user: { id: clientId } }, error: null });
    const response = await callback(new NextRequest(`${PREVIEW_WORKSPACE_ORIGIN}/auth/callback/sign-in?code=synthetic&state=${state}`));
    expect(response.headers.get("location")).toContain("error=entry_denied");
    expect(fixture.rpc).not.toHaveBeenCalled();
    expect(fixture.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("does not provision when token verification fails", async () => {
    const state = await begin();
    fixture.auth.getClaims.mockResolvedValue({ data: null, error: { message: "synthetic verification failure" } });
    await callback(new NextRequest(`${PREVIEW_WORKSPACE_ORIGIN}/auth/callback/sign-in?code=synthetic&state=${state}`));
    expect(fixture.auth.setSession).not.toHaveBeenCalled();
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it("rejects a Production start without initiating authorization", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const response = await start(new NextRequest(`${PREVIEW_WORKSPACE_ORIGIN}/auth/entry`));
    expect(response.headers.get("location")).toContain("error=entry_unavailable");
    expect(fixture.jar.has(PREVIEW_TRANSACTION_COOKIE)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
