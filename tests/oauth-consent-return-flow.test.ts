import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const fixtures = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    cookies: {
      get: vi.fn((name: string) => values.has(name) ? { value: values.get(name) } : undefined),
      set: vi.fn((name: string, value: string) => { values.set(name, value); })
    },
    signInWithOAuth: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    getUser: vi.fn(),
    rpc: vi.fn(),
    signOut: vi.fn()
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => fixtures.cookies }));
vi.mock("@/lib/supabase/server", () => ({
  createWorkspaceServerClient: async () => ({
    auth: {
      signInWithOAuth: fixtures.signInWithOAuth,
      exchangeCodeForSession: fixtures.exchangeCodeForSession,
      getUser: fixtures.getUser,
      signOut: fixtures.signOut
    },
    rpc: fixtures.rpc
  })
}));

import { GET as beginEntrySignIn } from "@/app/auth/entry/route";
import { GET as finishEntrySignIn } from "@/app/auth/callback/sign-in/route";
import { ENTRY_RETURN_COOKIE, ENTRY_SIGN_IN_COOKIE } from "@/lib/auth/entry-identity";

describe("OAuth consent continuation through existing Entry sign-in routes", () => {
  const consentPath = "/oauth/consent?authorization_id=abcdefghijklmnopqrstuvwxyz234567";

  beforeEach(() => {
    vi.clearAllMocks();
    fixtures.values.clear();
    vi.stubEnv("ENTRY_OIDC_PROVIDER", "custom:entry");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://workspace.leademergence.com");
    fixtures.signInWithOAuth.mockResolvedValue({ data: { url: "https://entry.leademergence.com/authorize" }, error: null });
    fixtures.exchangeCodeForSession.mockResolvedValue({ error: null });
    fixtures.getUser.mockResolvedValue({ data: { user: {
      identities: [{ provider: "custom:entry", id: "22222222-2222-4222-8222-222222222222", identity_data: { sub: "22222222-2222-4222-8222-222222222222" } }]
    } }, error: null });
    fixtures.rpc.mockResolvedValue({ error: null });
  });

  it("retains the same authorization ID from Entry handoff cookie to successful callback redirect", async () => {
    const entry = await beginEntrySignIn(new NextRequest(`https://workspace.leademergence.com/auth/entry?next=${encodeURIComponent(consentPath)}`));
    expect(entry.status).toBe(303);
    expect(entry.headers.get("location")).toBe("https://entry.leademergence.com/authorize");
    expect(fixtures.values.get(ENTRY_SIGN_IN_COOKIE)).toBe("sign-in");
    expect(fixtures.values.get(ENTRY_RETURN_COOKIE)).toBe(consentPath);

    const callback = await finishEntrySignIn(new NextRequest("https://workspace.leademergence.com/auth/callback/sign-in?code=dummy-entry-code"));
    expect(callback.status).toBe(303);
    expect(callback.headers.get("location")).toBe(`https://workspace.leademergence.com${consentPath}`);
    expect(fixtures.exchangeCodeForSession).toHaveBeenCalledWith("dummy-entry-code");
    expect(fixtures.rpc).toHaveBeenCalledWith("ensure_personal_workspace");
  });

  it("does not retain an OAuth path with unrelated query parameters", async () => {
    const entry = await beginEntrySignIn(new NextRequest(`https://workspace.leademergence.com/auth/entry?next=${encodeURIComponent(`${consentPath}&redirect=https://evil.example`)}`));
    expect(entry.status).toBe(303);
    expect(fixtures.values.get(ENTRY_RETURN_COOKIE)).toBe("/workspace");
  });
});
