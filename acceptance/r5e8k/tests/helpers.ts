import { bytesToBase64Url } from "../src/crypto";
import { prepareManifest, type RunManifest, type RunManifestCore } from "../src/manifest";
import type { StorageLike } from "../src/storage-lifecycle";

export class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

export async function makeManifest(
  overrides: Partial<RunManifestCore> = {},
): Promise<{ manifest: RunManifest; privateKey: CryptoKey }> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const publicJwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey & { kid: string };
  publicJwk.alg = "ES256";
  publicJwk.use = "sig";
  publicJwk.kid = "11111111-1111-4111-8111-111111111111";
  delete publicJwk.key_ops;
  delete publicJwk.ext;
  const now = Date.now();
  const core: RunManifestCore = {
    schema: "r5e8k-run-manifest/v1",
    syntheticOnly: false,
    runId: "22222222-2222-4222-8222-222222222222",
    projectRef: "vnjdubrnmxvmsccxmhst",
    authBaseUrl: "https://vnjdubrnmxvmsccxmhst.supabase.co/auth/v1",
    callbackUrl: "https://lead-emergence-entry-sso-preview-git-45c287-emergence-projects.vercel.app/auth/callback",
    fixture: {
      label: "C",
      subject: "33333333-3333-4333-8333-333333333333",
      currentEmail: "current@example.invalid",
      newEmail: "new@example.invalid",
    },
    publicKey: "sb_publishable_SYNTHETIC_TEST_ONLY",
    jwt: {
      issuer: "https://vnjdubrnmxvmsccxmhst.supabase.co/auth/v1",
      audience: "authenticated",
      role: "authenticated",
      aal: "aal1",
      kid: publicJwk.kid,
      jwk: publicJwk,
      lifetimeSeconds: 3600,
    },
    timing: {
      notBeforeEpochMs: now - 1000,
      artifactHardStopEpochMs: now + 3600000,
      pkceLifetimeMs: 240000,
      backendFlowStateLifetimeSeconds: 300,
      postExchangeActionLifetimeMs: 1800000,
    },
    authSettings: {
      goTrueVersion: "v2.196.0",
      secureEmailChange: true,
      passwordChangedNotification: false,
    },
    budget: {
      fixtureMailCalls: 2,
      fixtureDeliveries: 3,
      totalFixtureLimit: 3,
      totalMailCallLimit: 5,
      totalDeliveryLimit: 8,
    },
    allowFinalUserProbe: false,
    ...overrides,
  };
  return { manifest: await prepareManifest(core), privateKey: pair.privateKey };
}

export async function signRecoveryJwt(
  manifest: RunManifest,
  privateKey: CryptoKey,
  claimOverrides: Record<string, unknown> = {},
  headerOverrides: Record<string, unknown> = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: manifest.jwt.kid, typ: "JWT", ...headerOverrides };
  const claims = {
    iss: manifest.jwt.issuer,
    aud: manifest.jwt.audience,
    role: manifest.jwt.role,
    sub: manifest.fixture.subject,
    email: manifest.fixture.currentEmail,
    session_id: "44444444-4444-4444-8444-444444444444",
    aal: manifest.jwt.aal,
    amr: [{ method: "recovery", timestamp: now }],
    iat: now,
    exp: now + 3600,
    ...claimOverrides,
  };
  const encodedHeader = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedClaims = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`),
    ),
  );
  return `${encodedHeader}.${encodedClaims}.${bytesToBase64Url(signature)}`;
}
