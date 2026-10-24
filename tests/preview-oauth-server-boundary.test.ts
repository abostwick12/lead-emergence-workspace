import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PREVIEW_PROJECT_URL, PREVIEW_SESSION_COOKIE } from "@/lib/auth/preview-oauth";

const previewOrigin = "https://workspace-preview-abc.vercel.app";
const clientId = "11111111-1111-4111-8111-111111111111";
const fixture = vi.hoisted(() => ({
  getClaims: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
  createServerClient: vi.fn(),
  cookieSet: vi.fn(),
  cookies: [{ name: "sb-entry-dev-workspace-preview", value: "synthetic-session" }]
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({ createServerClient: fixture.createServerClient }));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: () => undefined,
  getAll: () => fixture.cookies,
  set: fixture.cookieSet
}) }));
vi.mock("@/lib/http/origin", () => ({ trustedWorkspaceOrigin: () => previewOrigin }));

import { updateWorkspaceSession } from "@/lib/supabase/proxy";
import { createWorkspaceServerClient } from "@/lib/supabase/server";
import { GET as callback } from "@/app/auth/callback/sign-in/route";

beforeEach(() => {
  vi.clearAllMocks();
  fixture.cookies = [{ name: PREVIEW_SESSION_COOKIE, value: "synthetic-session" }];
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("NEXT_PUBLIC_ENTRY_FIRST_PARTY_PREVIEW_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", PREVIEW_PROJECT_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-public-key");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", previewOrigin);
  vi.stubEnv("NEXT_PUBLIC_ENTRY_PREVIEW_CLIENT_ID", clientId);
  vi.stubGlobal("fetch", vi.fn());
  fixture.getClaims.mockResolvedValue({ data: null, error: null });
  fixture.signOut.mockResolvedValue({ error: null });
  fixture.createServerClient.mockReturnValue({ auth: { getClaims: fixture.getClaims, signOut: fixture.signOut }, rpc: fixture.rpc });
});

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each([
  ["missing", undefined],
  ["different", "https://other-preview.vercel.app"]
])("keeps shared helpers reachable but denies Preview callback with a %s private pin", async (_label, approvedOrigin) => {
  vi.stubEnv("ENTRY_PREVIEW_APPROVED_ORIGIN", approvedOrigin);
  const request = new NextRequest(`${previewOrigin}/auth/callback/sign-in?code=synthetic`, {
    headers: { cookie: `${PREVIEW_SESSION_COOKIE}=synthetic-session` }
  });

  const proxyResponse = await updateWorkspaceSession(request);
  expect(proxyResponse.status).toBe(200);
  await expect(createWorkspaceServerClient()).resolves.toBeTruthy();
  const response = await callback(request);

  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(`${previewOrigin}/login?error=entry_denied`);
  expect(fixture.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(fixture.rpc).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  for (const [, , options] of fixture.createServerClient.mock.calls) {
    expect(options.cookieOptions.name).toBe(PREVIEW_SESSION_COOKIE);
    expect(options.cookies.getAll()).toEqual([]);
    options.cookies.setAll([{ name: PREVIEW_SESSION_COOKIE, value: "replacement", options: { path: "/" } }], {});
  }
  expect(request.cookies.get(PREVIEW_SESSION_COOKIE)?.value).toBe("synthetic-session");
  expect(proxyResponse.cookies.get(PREVIEW_SESSION_COOKIE)).toBeUndefined();
  expect(fixture.cookieSet.mock.calls.some(([name]) => name === PREVIEW_SESSION_COOKIE)).toBe(false);
});

it("retains the isolated Preview cookie when the private origin pin matches", async () => {
  vi.stubEnv("ENTRY_PREVIEW_APPROVED_ORIGIN", previewOrigin);
  await updateWorkspaceSession(new NextRequest(`${previewOrigin}/workspace`, {
    headers: { cookie: `${PREVIEW_SESSION_COOKIE}=synthetic-session` }
  }));
  await createWorkspaceServerClient();

  for (const [, , options] of fixture.createServerClient.mock.calls) {
    expect(options.cookieOptions.name).toBe(PREVIEW_SESSION_COOKIE);
    expect(options.cookies.getAll()).toEqual([{ name: PREVIEW_SESSION_COOKIE, value: "synthetic-session" }]);
  }
});

it("preserves the existing cookie path when first-party Preview is disabled", async () => {
  vi.stubEnv("NEXT_PUBLIC_ENTRY_FIRST_PARTY_PREVIEW_ENABLED", "false");
  vi.stubEnv("ENTRY_PREVIEW_APPROVED_ORIGIN", undefined);
  fixture.cookies = [{ name: "sb-legacy-workspace", value: "synthetic-session" }];
  await updateWorkspaceSession(new NextRequest(`${previewOrigin}/workspace`, {
    headers: { cookie: "sb-legacy-workspace=synthetic-session" }
  }));
  await createWorkspaceServerClient();

  for (const [, , options] of fixture.createServerClient.mock.calls) {
    expect(options.cookieOptions.name).toBeUndefined();
    expect(options.cookies.getAll()).toEqual([{ name: "sb-legacy-workspace", value: "synthetic-session" }]);
  }
});
