// Draft first-party client path. Disabled unless every Preview boundary matches.
export const PREVIEW_PROJECT_URL = "https://vnjdubrnmxvmsccxmhst.supabase.co";
export const PREVIEW_ISSUER = `${PREVIEW_PROJECT_URL}/auth/v1`;
export const PREVIEW_SESSION_COOKIE = "sb-entry-dev-workspace-preview";
export const PREVIEW_TRANSACTION_COOKIE = "le_preview_oauth_transaction";
export const PREVIEW_IDENTITY_MARKER = "first-party:workspace-preview";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PreviewOAuthConfiguration = { clientId: string; origin: string };

function isCanonicalPreviewOrigin(origin: string | undefined): origin is string {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:" && parsed.origin === origin
      && !parsed.username && !parsed.password && parsed.pathname === "/"
      && !parsed.search && !parsed.hash && origin !== "https://workspace.leademergence.com";
  } catch {
    return false;
  }
}

export function previewOAuthConfiguration(
  enabled = process.env.NEXT_PUBLIC_ENTRY_FIRST_PARTY_PREVIEW_ENABLED,
  projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  appOrigin = process.env.NEXT_PUBLIC_APP_URL,
  clientId = process.env.NEXT_PUBLIC_ENTRY_PREVIEW_CLIENT_ID,
  approvedOrigin = process.env.ENTRY_PREVIEW_APPROVED_ORIGIN
): PreviewOAuthConfiguration | null {
  if (enabled !== "true") return null;
  if (projectUrl !== PREVIEW_PROJECT_URL || !isCanonicalPreviewOrigin(approvedOrigin)
      || appOrigin !== approvedOrigin || !clientId || !UUID.test(clientId)) {
    throw new Error("Preview OAuth boundary is not configured.");
  }
  return { clientId, origin: approvedOrigin };
}

export function requirePreviewServerBoundary(requestOrigin: string) {
  const configuration = previewOAuthConfiguration();
  if (!configuration || process.env.VERCEL_ENV !== "preview" || requestOrigin !== configuration.origin) {
    throw new Error("First-party OAuth is restricted to the dedicated Preview.");
  }
  return configuration;
}

function randomBase64Url() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createPreviewAuthorization(configuration: PreviewOAuthConfiguration, now = Date.now()) {
  const { clientId, origin } = configuration;
  const verifier = randomBase64Url();
  const state = randomBase64Url();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const url = new URL(`${PREVIEW_ISSUER}/oauth/authorize`);
  url.search = new URLSearchParams({
    response_type: "code", client_id: clientId,
    redirect_uri: `${origin}/auth/callback/sign-in`,
    scope: "email profile", state, code_challenge: challenge, code_challenge_method: "S256"
  }).toString();
  return { url: url.toString(), transaction: JSON.stringify({ verifier, state, clientId, createdAt: now }) };
}

export function consumePreviewTransaction(raw: string | undefined, state: string | null, clientId: string, now = Date.now()) {
  if (!raw || !state) throw new Error("Missing OAuth transaction.");
  const value = JSON.parse(raw) as Record<string, unknown>;
  if (value.clientId !== clientId || value.state !== state || typeof value.verifier !== "string"
      || !/^[A-Za-z0-9_-]{43}$/.test(value.verifier) || typeof value.createdAt !== "number"
      || now < value.createdAt || now - value.createdAt > 600_000) {
    throw new Error("Invalid OAuth transaction.");
  }
  return value.verifier;
}

// Call only after Supabase getClaims has verified the token signature and expiry.
export function verifyPreviewClaims(claims: Record<string, unknown>, clientId: string) {
  if (claims.iss !== PREVIEW_ISSUER || claims.aud !== "authenticated" || claims.role !== "authenticated"
      || claims.client_id !== clientId || claims.workspace_mcp === true || claims.workspace_mcp === "true"
      || typeof claims.sub !== "string" || !UUID.test(claims.sub)
      || typeof claims.session_id !== "string" || !UUID.test(claims.session_id)) {
    throw new Error("The token is not a Workspace Preview browser token.");
  }
  return claims.sub;
}

export async function exchangePreviewCode(code: string, verifier: string, configuration: PreviewOAuthConfiguration, fetcher: typeof fetch = fetch) {
  const { clientId, origin } = configuration;
  const response = await fetcher(`${PREVIEW_ISSUER}/oauth/token`, {
    method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: verifier,
      client_id: clientId, redirect_uri: `${origin}/auth/callback/sign-in` })
  });
  if (!response.ok) throw new Error("Preview code exchange failed.");
  const tokens = await response.json() as Record<string, unknown>;
  if (typeof tokens.access_token !== "string" || !tokens.access_token || typeof tokens.refresh_token !== "string"
      || !tokens.refresh_token || tokens.token_type !== "bearer") throw new Error("Invalid Preview token response.");
  return { access_token: tokens.access_token, refresh_token: tokens.refresh_token };
}

// Supabase's standard session store is retained; only OAuth refresh uses the
// OAuth client endpoint. The dedicated cookie prevents mixing legacy sessions.
export function previewSessionFetch(configuration: PreviewOAuthConfiguration | null, fetcher: typeof fetch = fetch): typeof fetch {
  if (!configuration) return fetcher;
  return async (input, init) => {
    const request = new Request(input instanceof Request ? input.clone() : input, init);
    const url = new URL(request.url);
    if (url.origin === PREVIEW_PROJECT_URL && url.pathname === "/auth/v1/token"
        && url.searchParams.get("grant_type") === "refresh_token" && request.method === "POST") {
      const body = await request.json() as Record<string, unknown>;
      if (typeof body.refresh_token !== "string" || !body.refresh_token) throw new Error("Missing Preview refresh token.");
      const response = await fetcher(`${PREVIEW_ISSUER}/oauth/token`, {
        method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: body.refresh_token, client_id: configuration.clientId })
      });
      if (!response.ok) return response;
      const tokens = await response.json() as Record<string, unknown>;
      if (typeof tokens.access_token !== "string" || tokens.token_type !== "bearer"
          || typeof tokens.expires_in !== "number" || tokens.expires_in <= 0
          || typeof tokens.refresh_token !== "string" || !tokens.refresh_token) throw new Error("Invalid Preview refresh response.");
      // OAuth token responses omit the user that auth-js requires when refreshing.
      // Ask Auth to validate the new token, then supply that verified user.
      const headers = new Headers({ Authorization: `Bearer ${tokens.access_token}` });
      const apiKey = request.headers.get("apikey");
      if (apiKey) headers.set("apikey", apiKey);
      const userResponse = await fetcher(`${PREVIEW_ISSUER}/user`, {
        headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000)
      });
      if (!userResponse.ok) throw new Error("Preview refreshed identity is unavailable.");
      const user = await userResponse.json() as Record<string, unknown>;
      const payload = tokens.access_token.split(".")[1];
      if (!payload) throw new Error("Invalid refreshed token.");
      const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
      const subject = verifyPreviewClaims(claims, configuration.clientId);
      if (user.id !== subject || typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) {
        throw new Error("Refreshed Preview identity mismatch.");
      }
      return Response.json({ ...tokens, user, refresh_token: tokens.refresh_token });
    }
    return fetcher(input, init);
  };
}
