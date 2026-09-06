import { base64UrlToBytes, fixedTimeEqual, isUuid } from "./crypto";
import type { RunManifest } from "./manifest";

interface JwtHeader {
  alg?: unknown;
  kid?: unknown;
  typ?: unknown;
  crit?: unknown;
  jku?: unknown;
  jwk?: unknown;
  x5u?: unknown;
}

interface RecoveryClaims {
  iss?: unknown;
  aud?: unknown;
  role?: unknown;
  sub?: unknown;
  email?: unknown;
  session_id?: unknown;
  aal?: unknown;
  amr?: unknown;
  iat?: unknown;
  exp?: unknown;
}

export interface VerifiedRecoveryToken {
  accessToken: string;
  issuedAtEpochSeconds: number;
  expiresAtEpochSeconds: number;
  actionDeadlineEpochMs: number;
}

function parsePart<T>(part: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part))) as T;
}

function audienceMatches(actual: unknown, expected: string): boolean {
  return actual === expected || (Array.isArray(actual) && actual.length === 1 && actual[0] === expected);
}

export async function verifyRecoveryAccessToken(
  accessToken: string,
  manifest: RunManifest,
  nowEpochMs: number,
  responseTiming?: { expiresIn?: unknown; expiresAt?: unknown },
): Promise<VerifiedRecoveryToken> {
  const parts = accessToken.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) throw new Error("malformed JWT");
  const [encodedHeader, encodedClaims, encodedSignature] = parts as [string, string, string];
  const header = parsePart<JwtHeader>(encodedHeader);
  const claims = parsePart<RecoveryClaims>(encodedClaims);

  if (
    header.alg !== "ES256" ||
    header.kid !== manifest.jwt.kid ||
    (header.typ !== undefined && header.typ !== "JWT") ||
    header.crit !== undefined ||
    header.jku !== undefined ||
    header.jwk !== undefined ||
    header.x5u !== undefined
  ) {
    throw new Error("JWT header rejected");
  }

  const verificationKey = await crypto.subtle.importKey(
    "jwk",
    manifest.jwt.jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const verified = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    verificationKey,
    Uint8Array.from(base64UrlToBytes(encodedSignature)).buffer,
    new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`),
  );
  if (!verified) throw new Error("JWT signature rejected");

  if (
    typeof claims.iss !== "string" ||
    !fixedTimeEqual(claims.iss, manifest.jwt.issuer) ||
    !audienceMatches(claims.aud, manifest.jwt.audience) ||
    claims.role !== manifest.jwt.role ||
    claims.sub !== manifest.fixture.subject ||
    claims.email !== manifest.fixture.currentEmail ||
    claims.aal !== manifest.jwt.aal ||
    typeof claims.session_id !== "string" ||
    !isUuid(claims.session_id)
  ) {
    throw new Error("JWT identity claims rejected");
  }

  if (!Array.isArray(claims.amr) || claims.amr.length !== 1) throw new Error("JWT AMR rejected");
  const amr = claims.amr[0] as Record<string, unknown>;
  if (
    Object.keys(amr).sort().join(",") !== "method,timestamp" ||
    amr.method !== "recovery" ||
    !Number.isInteger(amr.timestamp)
  ) {
    throw new Error("JWT recovery provenance rejected");
  }
  if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp)) throw new Error("JWT timing claims rejected");
  const issuedAt = claims.iat as number;
  const expiresAt = claims.exp as number;
  const nowSeconds = Math.floor(nowEpochMs / 1000);
  if (
    Math.abs(issuedAt - nowSeconds) > 30 ||
    expiresAt <= nowSeconds ||
    Math.abs(expiresAt - issuedAt - manifest.jwt.lifetimeSeconds) > 5
  ) {
    throw new Error("JWT validity window rejected");
  }
  if (Math.abs((amr.timestamp as number) - issuedAt) > 30 || (amr.timestamp as number) > nowSeconds + 30) {
    throw new Error("JWT AMR timestamp rejected");
  }
  if (expiresAt * 1000 - nowEpochMs < manifest.timing.postExchangeActionLifetimeMs) {
    throw new Error("insufficient action lifetime");
  }
  if (responseTiming?.expiresIn !== undefined) {
    if (!Number.isInteger(responseTiming.expiresIn) || Math.abs((responseTiming.expiresIn as number) - (expiresAt - issuedAt)) > 5) {
      throw new Error("expires_in mismatch");
    }
  }
  if (responseTiming?.expiresAt !== undefined) {
    if (!Number.isInteger(responseTiming.expiresAt) || Math.abs((responseTiming.expiresAt as number) - expiresAt) > 5) {
      throw new Error("expires_at mismatch");
    }
  }

  return {
    accessToken,
    issuedAtEpochSeconds: issuedAt,
    expiresAtEpochSeconds: expiresAt,
    actionDeadlineEpochMs: Math.min(nowEpochMs + manifest.timing.postExchangeActionLifetimeMs, expiresAt * 1000),
  };
}
