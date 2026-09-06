import { describe, expect, it } from "vitest";
import { verifyRecoveryAccessToken } from "../src/jwt-validator";
import { makeManifest, signRecoveryJwt } from "./helpers";

describe("signed recovery provenance", () => {
  it("accepts one genuine signed recovery AMR", async () => {
    const { manifest, privateKey } = await makeManifest();
    const token = await signRecoveryJwt(manifest, privateKey);
    const verified = await verifyRecoveryAccessToken(token, manifest, Date.now(), { expiresIn: 3600 });
    expect(verified.accessToken).toBe(token);
    expect(verified.actionDeadlineEpochMs).toBeGreaterThan(Date.now());
    expect(verified).not.toHaveProperty("sessionId");
  });

  it.each(["password", "otp", "magiclink"])("rejects %s purpose", async (method) => {
    const { manifest, privateKey } = await makeManifest();
    const token = await signRecoveryJwt(manifest, privateKey, { amr: [{ method, timestamp: Math.floor(Date.now() / 1000) }] });
    await expect(verifyRecoveryAccessToken(token, manifest, Date.now())).rejects.toThrow(/provenance/u);
  });

  it("rejects relabeled implicit recovery with OTP AMR", async () => {
    const { manifest, privateKey } = await makeManifest();
    const token = await signRecoveryJwt(manifest, privateKey, {
      amr: [{ method: "otp", timestamp: Math.floor(Date.now() / 1000) }],
      type: "recovery",
    });
    await expect(verifyRecoveryAccessToken(token, manifest, Date.now())).rejects.toThrow(/provenance/u);
  });

  it.each([
    ["issuer", { iss: "https://example.invalid/auth/v1" }],
    ["audience", { aud: "anon" }],
    ["role", { role: "service_role" }],
    ["subject", { sub: "99999999-9999-4999-8999-999999999999" }],
    ["email", { email: "wrong@example.invalid" }],
    ["session", { session_id: "not-a-uuid" }],
    ["AAL", { aal: "aal2" }],
    ["multiple AMR", { amr: [{ method: "recovery", timestamp: 1 }, { method: "otp", timestamp: 1 }] }],
  ])("rejects wrong %s claim", async (_name, overrides) => {
    const { manifest, privateKey } = await makeManifest();
    const token = await signRecoveryJwt(manifest, privateKey, overrides);
    await expect(verifyRecoveryAccessToken(token, manifest, Date.now())).rejects.toThrow();
  });

  it.each([
    ["HS256", { alg: "HS256" }],
    ["wrong kid", { kid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
    ["embedded jwk", { jwk: { kty: "oct", k: "AA" } }],
    ["remote jku", { jku: "https://example.invalid/jwks" }],
    ["critical", { crit: ["exp"] }],
  ])("rejects %s header", async (_name, header) => {
    const { manifest, privateKey } = await makeManifest();
    const token = await signRecoveryJwt(manifest, privateKey, {}, header);
    await expect(verifyRecoveryAccessToken(token, manifest, Date.now())).rejects.toThrow(/header/u);
  });

  it("rejects signature from an unpinned key", async () => {
    const trusted = await makeManifest();
    const attacker = await makeManifest();
    const token = await signRecoveryJwt(trusted.manifest, attacker.privateKey);
    await expect(verifyRecoveryAccessToken(token, trusted.manifest, Date.now())).rejects.toThrow(/signature/u);
  });

  it("rejects expired, future, and insufficient-lifetime tokens", async () => {
    const { manifest, privateKey } = await makeManifest();
    const now = Math.floor(Date.now() / 1000);
    for (const claims of [
      { iat: now - 4000, exp: now - 1, amr: [{ method: "recovery", timestamp: now - 4000 }] },
      { iat: now + 60, exp: now + 3660, amr: [{ method: "recovery", timestamp: now + 60 }] },
      { iat: now, exp: now + 1200, amr: [{ method: "recovery", timestamp: now }] },
      { iat: now - 60, exp: now + 3540, amr: [{ method: "recovery", timestamp: now - 60 }] },
      { iat: now, exp: now + 3590, amr: [{ method: "recovery", timestamp: now }] },
    ]) {
      const token = await signRecoveryJwt(manifest, privateKey, claims);
      await expect(verifyRecoveryAccessToken(token, manifest, Date.now())).rejects.toThrow();
    }
  });

  it("rejects malformed and tampered JWTs", async () => {
    const { manifest, privateKey } = await makeManifest();
    await expect(verifyRecoveryAccessToken("not-a-jwt", manifest, Date.now())).rejects.toThrow(/malformed/u);
    const token = await signRecoveryJwt(manifest, privateKey);
    await expect(verifyRecoveryAccessToken(`${token.slice(0, -2)}aa`, manifest, Date.now())).rejects.toThrow(/signature/u);
  });
});
