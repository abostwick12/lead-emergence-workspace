import { describe, expect, it } from "vitest";
import { prepareManifest, validateManifest, type RunManifest, type RunManifestCore } from "../src/manifest";
import { makeManifest } from "./helpers";

async function tamper(mutator: (manifest: RunManifest) => void): Promise<RunManifest> {
  const { manifest } = await makeManifest();
  mutator(manifest);
  return manifest;
}

describe("immutable manifest", () => {
  it("accepts an exact active manifest", async () => {
    const { manifest } = await makeManifest();
    await expect(validateManifest(manifest, Date.now())).resolves.toBeUndefined();
  });

  it.each([
    ["project", (manifest: RunManifest) => (manifest.projectRef = "wrong")],
    ["endpoint", (manifest: RunManifest) => (manifest.authBaseUrl = "https://example.invalid/auth/v1")],
    ["callback", (manifest: RunManifest) => (manifest.callbackUrl = "https://example.invalid/auth/callback")],
    ["subject", (manifest: RunManifest) => (manifest.fixture.subject = "not-a-uuid")],
    ["target", (manifest: RunManifest) => (manifest.fixture.newEmail = manifest.fixture.currentEmail)],
    ["GoTrue", (manifest: RunManifest) => ((manifest.authSettings.goTrueVersion as string) = "v2.195.0")],
    ["mail budget", (manifest: RunManifest) => ((manifest.budget.fixtureMailCalls as number) = 3)],
    ["final probe", (manifest: RunManifest) => ((manifest.allowFinalUserProbe as boolean) = true)],
  ])("rejects %s substitution", async (_name, mutate) => {
    await expect(validateManifest(await tamper(mutate), Date.now())).rejects.toThrow();
  });

  it.each([`sb_${"secret"}_abcdefghijklmnopqrstuvwxyz`, "service_role", "aaa.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.bbb"])(
    "rejects privileged key %s",
    async (publicKey) => {
      const { manifest } = await makeManifest();
      const core = { ...manifest, publicKey } as unknown as RunManifestCore;
      delete (core as unknown as Record<string, unknown>).manifestCoreSha256;
      delete (core as unknown as Record<string, unknown>).publicKeySha256;
      delete (core as unknown as Record<string, unknown>).fixtureBindingSha256;
      const rebuilt = await prepareManifest(core);
      await expect(validateManifest(rebuilt, Date.now())).rejects.toThrow();
    },
  );

  it("rejects synthetic artifacts in live mode", async () => {
    const { manifest } = await makeManifest({ syntheticOnly: true });
    await expect(validateManifest(manifest, Date.now())).rejects.toThrow(/synthetic artifact/u);
    await expect(validateManifest(manifest, Date.now(), { allowSynthetic: true })).resolves.toBeUndefined();
  });

  it("rejects not-yet-valid and expired artifacts", async () => {
    const now = Date.now();
    const future = await makeManifest({
      timing: {
        notBeforeEpochMs: now + 1000,
        artifactHardStopEpochMs: now + 5000,
        pkceLifetimeMs: 240000,
        backendFlowStateLifetimeSeconds: 300,
        postExchangeActionLifetimeMs: 1800000,
      },
    });
    await expect(validateManifest(future.manifest, now)).rejects.toThrow();
    await expect(validateManifest(future.manifest, now + 5000)).rejects.toThrow();
  });

  it("rejects extra fields", async () => {
    const { manifest } = await makeManifest();
    (manifest as unknown as Record<string, unknown>).debug = true;
    await expect(validateManifest(manifest, Date.now())).rejects.toThrow(/unexpected fields/u);
  });

  it.each(["fixture", "jwt", "jwk", "timing", "authSettings", "budget"])("rejects nested %s extension", async (section) => {
    const { manifest } = await makeManifest();
    const target = (section === "jwk" ? manifest.jwt.jwk : (manifest as unknown as Record<string, Record<string, unknown>>)[section]!) as Record<string, unknown>;
    target.unapproved = true;
    await expect(validateManifest(manifest, Date.now())).rejects.toThrow(/unexpected fields/u);
  });

  it("rejects a private signing key embedded as public verification material", async () => {
    const { manifest } = await makeManifest();
    (manifest.jwt.jwk as JsonWebKey).d = "A".repeat(43);
    await expect(validateManifest(manifest, Date.now())).rejects.toThrow(/unexpected fields/u);
  });
});
