import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { calendarAttemptAAD, type CalendarAccountSlot, encryptCalendarCredential } from "@/lib/calendar/credentials";
import { createOpaqueValue, decryptIntegrationValue, encryptIntegrationValue } from "@/lib/integrations/crypto";

export const CALENDAR_FLOW_COOKIE = "workspace_calendar_oauth";
export const CALENDAR_FLOW_TTL_MS = 10 * 60 * 1000;
export const CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.events"
] as const;

const EXPECTED_EMAIL: Record<CalendarAccountSlot, string> = {
  personal: "andrew.w.bostwick12@gmail.com",
  business: "andrew@leademergence.com"
};

type CalendarFlow = {
  codeVerifier: string;
  createdAt: number;
  slot: CalendarAccountSlot;
  state: string;
  workspaceId: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("Calendar connection is not configured.");
  return value;
}

export function calendarApplicationOrigin(): string {
  const url = new URL(required("NEXT_PUBLIC_APP_URL"));
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !localHttp) || url.username || url.password
    || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Calendar connection requires an HTTPS application origin.");
  }
  return url.origin;
}

export function isCalendarSlot(value: string): value is CalendarAccountSlot {
  return value === "personal" || value === "business";
}

export function calendarRedirectUri(slot: CalendarAccountSlot): string {
  return `${calendarApplicationOrigin()}/api/calendar/accounts/${slot}/callback`;
}

export function calendarStateHash(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

export function createCalendarFlow(input: { slot: CalendarAccountSlot; workspaceId: string }) {
  const state = createOpaqueValue();
  const codeVerifier = createOpaqueValue();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", required("WORKSPACE_GOOGLE_OAUTH_CLIENT_ID"));
  url.searchParams.set("redirect_uri", calendarRedirectUri(input.slot));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", CALENDAR_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", createHash("sha256").update(codeVerifier).digest("base64url"));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  const flow: CalendarFlow = { ...input, codeVerifier, createdAt: Date.now(), state };
  return {
    authorizationUrl: url.toString(),
    stateHash: calendarStateHash(state),
    sealedFlow: encryptIntegrationValue(JSON.stringify(flow), required("WORKSPACE_INTEGRATION_STATE_SECRET"), "workspace-calendar-oauth-flow")
  };
}

export function readCalendarFlow(sealed: string, slot: CalendarAccountSlot, state: string): CalendarFlow {
  const flow = JSON.parse(decryptIntegrationValue(sealed, required("WORKSPACE_INTEGRATION_STATE_SECRET"), "workspace-calendar-oauth-flow")) as CalendarFlow;
  const left = Buffer.from(flow.state ?? "");
  const right = Buffer.from(state);
  if (flow.slot !== slot || left.length !== right.length || !timingSafeEqual(left, right)
    || !Number.isFinite(flow.createdAt) || Date.now() < flow.createdAt
    || Date.now() - flow.createdAt > CALENDAR_FLOW_TTL_MS
    || !flow.codeVerifier || !flow.workspaceId) {
    throw new Error("Calendar connection request expired or changed.");
  }
  return flow;
}

type GoogleToken = { access_token?: unknown; refresh_token?: unknown; scope?: unknown; expires_in?: unknown };

export async function exchangeAndVerifyCalendarCode(input: { code: string; flow: CalendarFlow }): Promise<{
  refreshToken: string;
  subjectHash: string;
  expiresAt: string | null;
}> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: required("WORKSPACE_GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: required("WORKSPACE_GOOGLE_OAUTH_CLIENT_SECRET"),
      code: input.code,
      code_verifier: input.flow.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: calendarRedirectUri(input.flow.slot)
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error("Google did not complete Calendar authorization.");
  const token = await response.json() as GoogleToken;
  const grantedScopes = typeof token.scope === "string" ? new Set(token.scope.split(/\s+/)) : new Set<string>();
  if (typeof token.access_token !== "string" || typeof token.refresh_token !== "string" || !token.refresh_token
    || !CALENDAR_SCOPES.every((scope) => grantedScopes.has(scope))) {
    throw new Error("Google did not grant the required Calendar access.");
  }
  const identityResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(5000)
  });
  if (!identityResponse.ok) throw new Error("Google account identity could not be checked.");
  const identity = await identityResponse.json() as { sub?: unknown; email?: unknown; email_verified?: unknown };
  if (typeof identity.sub !== "string" || !identity.sub || identity.email_verified !== true
    || typeof identity.email !== "string" || identity.email.toLowerCase() !== EXPECTED_EMAIL[input.flow.slot]) {
    throw new Error("This Google account does not match the selected Calendar slot.");
  }
  return {
    refreshToken: token.refresh_token,
    subjectHash: createHash("sha256").update(identity.sub).digest("hex"),
    expiresAt: typeof token.expires_in === "number" && token.expires_in > 0
      ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null
  };
}

function ownerClient(accessToken: string) {
  return createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: process.env.NEXT_PUBLIC_WORKSPACE_SCHEMA?.trim() || "workspace" },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

export async function storeCalendarAttempt(input: {
  accessToken: string; workspaceId: string; slot: CalendarAccountSlot; stateHash: string;
}): Promise<void> {
  const ciphertext = encryptIntegrationValue(
    input.accessToken, required("WORKSPACE_INTEGRATION_STATE_SECRET"),
    calendarAttemptAAD(input.workspaceId, input.slot, input.stateHash)
  );
  const { error } = await ownerClient(input.accessToken).rpc("start_owner_calendar_oauth_attempt", {
    p_workspace_id: input.workspaceId,
    p_account_slot: input.slot,
    p_state_hash: input.stateHash,
    p_ciphertext: ciphertext
  });
  if (error) throw new Error("Calendar connection request could not be saved.");
}

export async function finishCalendarAccount(input: {
  accessToken: string; workspaceId: string; slot: CalendarAccountSlot; stateHash: string;
  refreshToken: string; subjectHash: string; expiresAt: string | null;
}): Promise<void> {
  const ciphertext = encryptCalendarCredential(input.refreshToken, required("WORKSPACE_INTEGRATION_ENCRYPTION_KEY"), input.workspaceId, input.slot);
  const { error } = await ownerClient(input.accessToken).rpc("finish_owner_calendar_oauth_attempt", {
    p_workspace_id: input.workspaceId,
    p_account_slot: input.slot,
    p_state_hash: input.stateHash,
    p_ciphertext: ciphertext,
    p_key_version: 1,
    p_account_subject_hash: input.subjectHash,
    p_token_expires_at: input.expiresAt,
    p_refresh_token_present: true
  });
  if (error) throw new Error("Calendar account could not be saved.");
}

export async function revokeCalendarAccount(accessToken: string, workspaceId: string, slot: CalendarAccountSlot): Promise<void> {
  const { error } = await ownerClient(accessToken).rpc("revoke_owner_calendar_credential", {
    p_workspace_id: workspaceId,
    p_account_slot: slot
  });
  if (error) throw new Error("Calendar account could not be disconnected.");
}
