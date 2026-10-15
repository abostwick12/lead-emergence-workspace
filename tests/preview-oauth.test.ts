import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  consumePreviewTransaction, createPreviewAuthorization, exchangePreviewCode,
  previewOAuthConfiguration, previewSessionFetch, requirePreviewServerBoundary,
  verifyPreviewClaims, PREVIEW_ISSUER, PREVIEW_PROJECT_URL
} from "@/lib/auth/preview-oauth";

const clientId = "11111111-1111-4111-8111-111111111111";
const previewOrigin = "https://workspace-preview-abc.vercel.app";
const configuration = { clientId, origin: previewOrigin };
const userId = "22222222-2222-4222-8222-222222222222";
const sessionId = "33333333-3333-4333-8333-333333333333";
const claims = () => ({ sub: userId, session_id: sessionId, iss: PREVIEW_ISSUER,
  aud: "authenticated", role: "authenticated", client_id: clientId, exp: Math.floor(Date.now() / 1000) + 3600 });
const jwt = (body = claims()) => `${btoa(JSON.stringify({ alg: "HS256" }))}.${btoa(JSON.stringify(body))}.synthetic`;
afterEach(() => vi.unstubAllEnvs());

describe("Preview boundary", () => {
  it("keeps the existing path when disabled", () => {
    expect(previewOAuthConfiguration("false", "wrong", "wrong", "wrong")).toBeNull();
  });
  it.each([
    ["https://neabiaimygdviwobpicj.supabase.co", previewOrigin, clientId],
    [PREVIEW_PROJECT_URL, "https://workspace.leademergence.com", clientId],
    [PREVIEW_PROJECT_URL, previewOrigin, "wrong"]
  ])("rejects mismatched project, origin or client", (project, origin, client) => {
    expect(() => previewOAuthConfiguration("true", project, origin, client, previewOrigin)).toThrow();
  });
  it.each([
    undefined, "https://workspace.leademergence.com", "http://workspace-preview-abc.vercel.app",
    `${previewOrigin}/path`, `${previewOrigin}/`, `${previewOrigin}?x=1`,
    "https://workspace-preview-abc.vercel.app@wrong.example"
  ])("rejects absent or noncanonical approved origin %s", (approvedOrigin) => {
    expect(() => previewOAuthConfiguration("true", PREVIEW_PROJECT_URL, approvedOrigin, clientId, approvedOrigin)).toThrow();
  });
  it("requires the app origin to match the separately approved origin", () => {
    expect(() => previewOAuthConfiguration("true", PREVIEW_PROJECT_URL, "https://other-preview.vercel.app", clientId, previewOrigin)).toThrow();
    expect(previewOAuthConfiguration("true", PREVIEW_PROJECT_URL, previewOrigin, clientId, previewOrigin)).toEqual(configuration);
  });
  it("rejects a Production deployment even with Preview inputs", () => {
    vi.stubEnv("NEXT_PUBLIC_ENTRY_FIRST_PARTY_PREVIEW_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", PREVIEW_PROJECT_URL);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", previewOrigin);
    vi.stubEnv("NEXT_PUBLIC_ENTRY_PREVIEW_CLIENT_ID", clientId);
    vi.stubEnv("ENTRY_PREVIEW_APPROVED_ORIGIN", previewOrigin);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => requirePreviewServerBoundary(previewOrigin)).toThrow();
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(requirePreviewServerBoundary(previewOrigin)).toEqual(configuration);
    expect(() => requirePreviewServerBoundary("https://wrong.example")).toThrow();
  });
});

describe("Authorization transaction", () => {
  it("binds the callback and an S256 challenge to a fresh verifier/state", async () => {
    const first = await createPreviewAuthorization(configuration, 10_000);
    const second = await createPreviewAuthorization(configuration, 10_000);
    const url = new URL(first.url);
    const transaction = JSON.parse(first.transaction);
    expect(url.origin + url.pathname).toBe(`${PREVIEW_ISSUER}/oauth/authorize`);
    expect(url.searchParams.get("redirect_uri")).toBe(`${previewOrigin}/auth/callback/sign-in`);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(transaction.verifier)));
    expect(url.searchParams.get("code_challenge")).toBe(Buffer.from(hash).toString("base64url"));
    expect(url.searchParams.has("code_verifier")).toBe(false);
    expect(first.transaction).not.toBe(second.transaction);
    expect(consumePreviewTransaction(first.transaction, transaction.state, clientId, 20_000)).toBe(transaction.verifier);
    expect(() => consumePreviewTransaction(first.transaction, "wrong", clientId, 20_000)).toThrow();
    expect(() => consumePreviewTransaction(first.transaction, transaction.state, userId, 20_000)).toThrow();
    expect(() => consumePreviewTransaction(first.transaction, transaction.state, clientId, 610_001)).toThrow();
    expect(() => consumePreviewTransaction(first.transaction, transaction.state, clientId, 9_999)).toThrow();
    expect(() => consumePreviewTransaction(undefined, transaction.state, clientId)).toThrow();
  });
  it("exchanges at the pinned endpoint without exposing the verifier in the URL", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ access_token: "synthetic", refresh_token: "synthetic-refresh", token_type: "bearer" }));
    await exchangePreviewCode("synthetic-code", "synthetic-verifier", configuration, fetcher);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(`${PREVIEW_ISSUER}/oauth/token`);
    expect(init.redirect).toBe("error");
    expect(init.body.get("client_id")).toBe(clientId);
    expect(init.body.get("code_verifier")).toBe("synthetic-verifier");
    expect(init.body.get("redirect_uri")).toBe(`${previewOrigin}/auth/callback/sign-in`);
  });
  it("rejects a failed or incomplete exchange", async () => {
    await expect(exchangePreviewCode("x", "y", configuration, vi.fn().mockResolvedValue(new Response("", { status: 400 })))).rejects.toThrow();
    await expect(exchangePreviewCode("x", "y", configuration, vi.fn().mockResolvedValue(Response.json({ access_token: "x" })))).rejects.toThrow();
  });
});

describe("Verified token admission", () => {
  it("retains the issuer's canonical user UUID", () => expect(verifyPreviewClaims(claims(), clientId)).toBe(userId));
  it.each([
    { iss: "https://wrong.example" }, { aud: "https://workspace.leademergence.com/api/mcp" },
    { client_id: userId }, { workspace_mcp: true }, { workspace_mcp: "true" },
    { sub: "invalid" }, { session_id: "invalid" }, { role: "anon" }
  ])("rejects wrong authority %j", (change) => expect(() => verifyPreviewClaims({ ...claims(), ...change }, clientId)).toThrow());
});

describe("OAuth session renewal", () => {
  it("uses the standard SDK session lifecycle with the OAuth endpoint and rotated token", async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      calls.push(url.toString());
      if (url.pathname.endsWith("/oauth/token")) {
        expect(new URLSearchParams(init?.body as URLSearchParams).get("client_id")).toBe(clientId);
        return Response.json({ access_token: jwt(), refresh_token: "synthetic-rotated", expires_in: 3600, token_type: "bearer" });
      }
      if (url.pathname.endsWith("/user")) return Response.json({ id: userId, aud: "authenticated", app_metadata: {}, user_metadata: {} });
      throw new Error("Unexpected endpoint");
    };
    const supabase = createClient(PREVIEW_PROJECT_URL, "synthetic-public-key", {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { fetch: previewSessionFetch(configuration, fetcher) }
    });
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: "synthetic-old" });
    expect(error).toBeNull();
    expect(data.user?.id).toBe(userId);
    expect(data.session?.refresh_token).toBe("synthetic-rotated");
    expect(calls).toEqual([`${PREVIEW_ISSUER}/oauth/token`, `${PREVIEW_ISSUER}/user`]);
  });
  it("rejects a renewed token for another client", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: jwt({ ...claims(), client_id: userId }), refresh_token: "synthetic-rotated", expires_in: 3600, token_type: "bearer" }))
      .mockResolvedValueOnce(Response.json({ id: userId }));
    const wrapped = previewSessionFetch(configuration, fetcher);
    await expect(wrapped(`${PREVIEW_ISSUER}/token?grant_type=refresh_token`, {
      method: "POST", body: JSON.stringify({ refresh_token: "synthetic" })
    })).rejects.toThrow("The token is not a Workspace Preview browser token.");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([
    ["missing", undefined], ["empty", ""], ["non-string", 123]
  ])("rejects a %s replacement refresh token without retaining the old token", async (_case, replacement) => {
    const tokens = { access_token: jwt(), expires_in: 3600, token_type: "bearer", refresh_token: replacement };
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(tokens));
    const wrapped = previewSessionFetch(configuration, fetcher);
    await expect(wrapped(`${PREVIEW_PROJECT_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", body: JSON.stringify({ refresh_token: "synthetic-old" })
    })).rejects.toThrow("Invalid Preview refresh response.");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not rewrite other-project requests or disabled mode", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({}));
    expect(previewSessionFetch(null, fetcher)).toBe(fetcher);
    const url = "https://wrong.example/auth/v1/token?grant_type=refresh_token";
    const init = { method: "POST", body: "{}" };
    await previewSessionFetch(configuration, fetcher)(url, init);
    expect(fetcher).toHaveBeenCalledWith(url, init);
  });
  it("preserves the body of an ordinary Request when passing it through", async () => {
    const request = new Request(`${PREVIEW_PROJECT_URL}/rest/v1/rpc/synthetic`, { method: "POST", body: "{\"synthetic\":true}" });
    const fetcher: typeof fetch = async (input) => {
      expect(await (input as Request).text()).toBe('{"synthetic":true}');
      return Response.json({});
    };
    await previewSessionFetch(configuration, fetcher)(request);
  });
});
