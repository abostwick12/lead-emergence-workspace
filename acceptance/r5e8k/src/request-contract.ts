import type { RunManifest } from "./manifest";

export type ApprovedOperation = "RECOVERY" | "EXCHANGE" | "EMAIL_CHANGE" | "PASSWORD_CHANGE";

export interface ApprovedRequest {
  operation: ApprovedOperation;
  url: string;
  init: RequestInit;
}

const BASE_FETCH_OPTIONS = Object.freeze({
  mode: "cors" as const,
  credentials: "omit" as const,
  redirect: "error" as const,
  cache: "no-store" as const,
  keepalive: false,
  referrerPolicy: "no-referrer" as const,
});

function publicHeaders(manifest: RunManifest): Readonly<Record<string, string>> {
  return Object.freeze({
    Accept: "application/json",
    "Content-Type": "application/json",
    apikey: manifest.publicKey,
    Authorization: `Bearer ${manifest.publicKey}`,
  });
}

function authenticatedHeaders(manifest: RunManifest, accessToken: string): Readonly<Record<string, string>> {
  if (accessToken.length < 32 || /[\r\n]/u.test(accessToken)) throw new Error("invalid access token");
  return Object.freeze({
    Accept: "application/json",
    "Content-Type": "application/json",
    apikey: manifest.publicKey,
    Authorization: `Bearer ${accessToken}`,
  });
}

function jsonRequest(
  operation: ApprovedOperation,
  url: string,
  method: "POST" | "PUT",
  headers: Readonly<Record<string, string>>,
  body: Record<string, string>,
): ApprovedRequest {
  return Object.freeze({
    operation,
    url,
    init: Object.freeze({
      ...BASE_FETCH_OPTIONS,
      method,
      headers,
      body: JSON.stringify(body),
    }),
  });
}

export function buildRecoveryRequest(manifest: RunManifest, codeChallenge: string): ApprovedRequest {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(codeChallenge)) throw new Error("invalid S256 challenge");
  const url = `${manifest.authBaseUrl}/recover?redirect_to=${encodeURIComponent(manifest.callbackUrl)}`;
  return jsonRequest("RECOVERY", url, "POST", publicHeaders(manifest), {
    email: manifest.fixture.currentEmail,
    code_challenge: codeChallenge,
    code_challenge_method: "s256",
  });
}

export function buildExchangeRequest(manifest: RunManifest, authCode: string, codeVerifier: string): ApprovedRequest {
  if (!/^[0-9a-f-]{36}$/iu.test(authCode) || !/^[A-Za-z0-9_-]{86}$/u.test(codeVerifier)) {
    throw new Error("invalid PKCE exchange material");
  }
  return jsonRequest(
    "EXCHANGE",
    `${manifest.authBaseUrl}/token?grant_type=pkce`,
    "POST",
    publicHeaders(manifest),
    { auth_code: authCode, code_verifier: codeVerifier },
  );
}

export function buildEmailChangeRequest(manifest: RunManifest, accessToken: string): ApprovedRequest {
  const url = `${manifest.authBaseUrl}/user?redirect_to=${encodeURIComponent(manifest.callbackUrl)}`;
  return jsonRequest("EMAIL_CHANGE", url, "PUT", authenticatedHeaders(manifest, accessToken), {
    email: manifest.fixture.newEmail,
  });
}

export function buildPasswordChangeRequest(
  manifest: RunManifest,
  accessToken: string,
  password: string,
): ApprovedRequest {
  if (password.length === 0 || /[\r\n]/u.test(password)) throw new Error("invalid password input");
  return jsonRequest("PASSWORD_CHANGE", `${manifest.authBaseUrl}/user`, "PUT", authenticatedHeaders(manifest, accessToken), {
    password,
  });
}

export function assertApprovedRequest(manifest: RunManifest, request: ApprovedRequest): void {
  const initKeys = Object.keys(request.init).sort().join(",");
  if (initKeys !== "body,cache,credentials,headers,keepalive,method,mode,redirect,referrerPolicy") {
    throw new Error("request init shape denied");
  }
  if (
    request.init.mode !== "cors" ||
    request.init.credentials !== "omit" ||
    request.init.redirect !== "error" ||
    request.init.cache !== "no-store" ||
    request.init.keepalive !== false ||
    request.init.referrerPolicy !== "no-referrer"
  ) {
    throw new Error("request transport contract mismatch");
  }
  const headers = request.init.headers as Record<string, string>;
  if (
    headers === null ||
    typeof headers !== "object" ||
    Object.keys(headers).sort().join(",") !== "Accept,Authorization,Content-Type,apikey" ||
    headers.Accept !== "application/json" ||
    headers["Content-Type"] !== "application/json" ||
    headers.apikey !== manifest.publicKey ||
    typeof headers.Authorization !== "string" ||
    !headers.Authorization.startsWith("Bearer ")
  ) {
    throw new Error("request header shape denied");
  }
  if (typeof request.init.body !== "string") throw new Error("request body shape denied");
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(request.init.body) as Record<string, unknown>;
  } catch {
    throw new Error("request body shape denied");
  }
  const bodyKeys = Object.keys(body).sort().join(",");
  if (request.operation === "RECOVERY") {
    if (
      request.init.method !== "POST" ||
      request.url !== `${manifest.authBaseUrl}/recover?redirect_to=${encodeURIComponent(manifest.callbackUrl)}` ||
      headers.Authorization !== `Bearer ${manifest.publicKey}` ||
      bodyKeys !== "code_challenge,code_challenge_method,email" ||
      body.email !== manifest.fixture.currentEmail ||
      body.code_challenge_method !== "s256" ||
      typeof body.code_challenge !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/u.test(body.code_challenge)
    ) {
      throw new Error("request shape denied");
    }
    return;
  }
  if (request.operation === "EXCHANGE") {
    if (
      request.init.method !== "POST" ||
      request.url !== `${manifest.authBaseUrl}/token?grant_type=pkce` ||
      headers.Authorization !== `Bearer ${manifest.publicKey}` ||
      bodyKeys !== "auth_code,code_verifier" ||
      typeof body.auth_code !== "string" ||
      !/^[0-9a-f-]{36}$/iu.test(body.auth_code) ||
      typeof body.code_verifier !== "string" ||
      !/^[A-Za-z0-9_-]{86}$/u.test(body.code_verifier)
    ) {
      throw new Error("request shape denied");
    }
    return;
  }
  const bearer = headers.Authorization.slice("Bearer ".length);
  if (bearer.length < 32 || bearer === manifest.publicKey) throw new Error("authenticated request credential denied");
  if (request.operation === "EMAIL_CHANGE") {
    if (
      request.init.method !== "PUT" ||
      request.url !== `${manifest.authBaseUrl}/user?redirect_to=${encodeURIComponent(manifest.callbackUrl)}` ||
      bodyKeys !== "email" ||
      body.email !== manifest.fixture.newEmail
    ) {
      throw new Error("request shape denied");
    }
    return;
  }
  if (request.operation === "PASSWORD_CHANGE") {
    if (
      request.init.method !== "PUT" ||
      request.url !== `${manifest.authBaseUrl}/user` ||
      bodyKeys !== "password" ||
      typeof body.password !== "string" ||
      body.password.length === 0 ||
      /[\r\n]/u.test(body.password)
    ) {
      throw new Error("request shape denied");
    }
    return;
  }
  throw new Error("request operation denied");
}

export async function sendExactlyOnce(
  fetcher: typeof fetch,
  manifest: RunManifest,
  request: ApprovedRequest,
): Promise<Response> {
  assertApprovedRequest(manifest, request);
  return fetcher(request.url, request.init);
}
