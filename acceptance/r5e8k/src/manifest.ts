import { canonicalJson, fixedTimeEqual, isUuid, sha256Hex } from "./crypto";

export const EXPECTED_PROJECT_REF = "vnjdubrnmxvmsccxmhst";
export const EXPECTED_CALLBACK =
  "https://lead-emergence-entry-sso-preview-git-45c287-emergence-projects.vercel.app/auth/callback";

export interface RunManifestCore {
  schema: "r5e8k-run-manifest/v1";
  syntheticOnly: boolean;
  runId: string;
  projectRef: string;
  authBaseUrl: string;
  callbackUrl: string;
  fixture: {
    label: "C";
    subject: string;
    currentEmail: string;
    newEmail: string;
  };
  publicKey: string;
  jwt: {
    issuer: string;
    audience: "authenticated";
    role: "authenticated";
    aal: "aal1";
    kid: string;
    jwk: JsonWebKey & { kid: string };
    lifetimeSeconds: 3600;
  };
  timing: {
    notBeforeEpochMs: number;
    artifactHardStopEpochMs: number;
    pkceLifetimeMs: 240000;
    backendFlowStateLifetimeSeconds: 300;
    postExchangeActionLifetimeMs: 1800000;
  };
  authSettings: {
    goTrueVersion: "v2.196.0";
    secureEmailChange: true;
    passwordChangedNotification: false;
  };
  budget: {
    fixtureMailCalls: 2;
    fixtureDeliveries: 3;
    totalFixtureLimit: 3;
    totalMailCallLimit: 5;
    totalDeliveryLimit: 8;
  };
  allowFinalUserProbe: false;
}

export interface RunManifest extends RunManifestCore {
  manifestCoreSha256: string;
  publicKeySha256: string;
  fixtureBindingSha256: string;
}

export function manifestCore(value: RunManifest): RunManifestCore {
  const {
    manifestCoreSha256: _manifestCoreSha256,
    publicKeySha256: _publicKeySha256,
    fixtureBindingSha256: _fixtureBindingSha256,
    ...core
  } = value;
  return core;
}

export async function prepareManifest(core: RunManifestCore): Promise<RunManifest> {
  const fixtureBindingSha256 = await sha256Hex(canonicalJson(core.fixture));
  return {
    ...core,
    manifestCoreSha256: await sha256Hex(canonicalJson(core)),
    publicKeySha256: await sha256Hex(core.publicKey),
    fixtureBindingSha256,
  };
}

function requireExactKeys(record: object, expected: readonly string[], label: string): void {
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} has unexpected fields`);
  }
}

function rejectPrivilegedKey(key: string): void {
  if (key.startsWith("sb_secret_") || /service[_-]?role/iu.test(key)) {
    throw new Error("privileged public key substitution");
  }
  const segments = key.split(".");
  if (segments.length === 3) {
    try {
      const payload = JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(atob(`${segments[1]!.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat((4 - (segments[1]!.length % 4)) % 4)}`), (character) => character.charCodeAt(0)),
        ),
      ) as { role?: unknown };
      if (payload.role !== "anon") throw new Error("public JWT key role is not anon");
    } catch (error) {
      if (error instanceof Error && error.message === "public JWT key role is not anon") throw error;
      throw new Error("malformed public JWT key");
    }
  } else if (!key.startsWith("sb_publishable_")) {
    throw new Error("unrecognized public key format");
  }
}

export async function validateManifest(
  manifest: RunManifest,
  nowEpochMs: number,
  options: { allowSynthetic?: boolean } = {},
): Promise<void> {
  requireExactKeys(
    manifest,
    [
      "schema",
      "syntheticOnly",
      "runId",
      "projectRef",
      "authBaseUrl",
      "callbackUrl",
      "fixture",
      "publicKey",
      "jwt",
      "timing",
      "authSettings",
      "budget",
      "allowFinalUserProbe",
      "manifestCoreSha256",
      "publicKeySha256",
      "fixtureBindingSha256",
    ],
    "manifest",
  );
  if (manifest.schema !== "r5e8k-run-manifest/v1") throw new Error("manifest schema mismatch");
  requireExactKeys(manifest.fixture, ["label", "subject", "currentEmail", "newEmail"], "fixture");
  requireExactKeys(manifest.jwt, ["issuer", "audience", "role", "aal", "kid", "jwk", "lifetimeSeconds"], "jwt");
  requireExactKeys(manifest.jwt.jwk, ["kty", "crv", "alg", "use", "kid", "x", "y"], "jwt jwk");
  requireExactKeys(
    manifest.timing,
    ["notBeforeEpochMs", "artifactHardStopEpochMs", "pkceLifetimeMs", "backendFlowStateLifetimeSeconds", "postExchangeActionLifetimeMs"],
    "timing",
  );
  requireExactKeys(manifest.authSettings, ["goTrueVersion", "secureEmailChange", "passwordChangedNotification"], "auth settings");
  requireExactKeys(
    manifest.budget,
    ["fixtureMailCalls", "fixtureDeliveries", "totalFixtureLimit", "totalMailCallLimit", "totalDeliveryLimit"],
    "budget",
  );
  if (manifest.syntheticOnly && !options.allowSynthetic) throw new Error("synthetic artifact is inert");
  if (!isUuid(manifest.runId) || !isUuid(manifest.fixture.subject)) throw new Error("invalid run or subject UUID");
  if (manifest.projectRef !== EXPECTED_PROJECT_REF) throw new Error("project substitution");
  if (manifest.authBaseUrl !== `https://${EXPECTED_PROJECT_REF}.supabase.co/auth/v1`) {
    throw new Error("Auth endpoint substitution");
  }
  if (manifest.callbackUrl !== EXPECTED_CALLBACK) throw new Error("callback substitution");
  if (manifest.fixture.label !== "C") throw new Error("fixture substitution");
  if (
    !manifest.fixture.currentEmail.includes("@") ||
    !manifest.fixture.newEmail.includes("@") ||
    manifest.fixture.currentEmail === manifest.fixture.newEmail
  ) {
    throw new Error("invalid fixture email binding");
  }
  rejectPrivilegedKey(manifest.publicKey);
  if (!fixedTimeEqual(await sha256Hex(manifest.publicKey), manifest.publicKeySha256)) {
    throw new Error("public key fingerprint mismatch");
  }
  if (!fixedTimeEqual(await sha256Hex(canonicalJson(manifestCore(manifest))), manifest.manifestCoreSha256)) {
    throw new Error("manifest fingerprint mismatch");
  }
  if (!fixedTimeEqual(await sha256Hex(canonicalJson(manifest.fixture)), manifest.fixtureBindingSha256)) {
    throw new Error("fixture fingerprint mismatch");
  }
  if (
    manifest.jwt.issuer !== manifest.authBaseUrl ||
    manifest.jwt.audience !== "authenticated" ||
    manifest.jwt.role !== "authenticated" ||
    manifest.jwt.aal !== "aal1" ||
    manifest.jwt.lifetimeSeconds !== 3600 ||
    manifest.jwt.kid !== manifest.jwt.jwk.kid ||
    manifest.jwt.jwk.kty !== "EC" ||
    manifest.jwt.jwk.crv !== "P-256" ||
    manifest.jwt.jwk.alg !== "ES256" ||
    manifest.jwt.jwk.use !== "sig" ||
    typeof manifest.jwt.jwk.x !== "string" ||
    typeof manifest.jwt.jwk.y !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/u.test(manifest.jwt.jwk.x) ||
    !/^[A-Za-z0-9_-]{43}$/u.test(manifest.jwt.jwk.y)
  ) {
    throw new Error("JWT trust manifest mismatch");
  }
  if (
    manifest.timing.pkceLifetimeMs !== 240000 ||
    manifest.timing.backendFlowStateLifetimeSeconds !== 300 ||
    manifest.timing.postExchangeActionLifetimeMs !== 1800000 ||
    nowEpochMs < manifest.timing.notBeforeEpochMs ||
    nowEpochMs >= manifest.timing.artifactHardStopEpochMs
  ) {
    throw new Error("manifest timing mismatch or expiration");
  }
  if (
    manifest.authSettings.goTrueVersion !== "v2.196.0" ||
    manifest.authSettings.secureEmailChange !== true ||
    manifest.authSettings.passwordChangedNotification !== false ||
    manifest.allowFinalUserProbe !== false
  ) {
    throw new Error("Auth setting contract mismatch");
  }
  if (
    manifest.budget.fixtureMailCalls !== 2 ||
    manifest.budget.fixtureDeliveries !== 3 ||
    manifest.budget.totalFixtureLimit !== 3 ||
    manifest.budget.totalMailCallLimit !== 5 ||
    manifest.budget.totalDeliveryLimit !== 8
  ) {
    throw new Error("budget contract mismatch");
  }
}
