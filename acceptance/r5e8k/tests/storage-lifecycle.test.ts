import { describe, expect, it } from "vitest";
import {
  commitExchange,
  continuationKey,
  createContinuation,
  markRecoverySent,
  readRecord,
  replaceWithTerminal,
  validateContinuation,
  writeAndVerify,
} from "../src/storage-lifecycle";
import { makeManifest, MemoryStorage } from "./helpers";

describe("PKCE continuation lifecycle", () => {
  it("stores only the exact pre-exchange continuation schema", async () => {
    const { manifest } = await makeManifest();
    const storage = new MemoryStorage();
    const now = Date.now();
    const record = await createContinuation(manifest, now);
    expect(record.codeVerifier).toMatch(/^[A-Za-z0-9_-]{86}$/u);
    expect(record.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(record.absoluteExpiryEpochMs).toBe(now + 240000);
    writeAndVerify(storage, continuationKey(manifest), record);
    validateContinuation(readRecord(storage, continuationKey(manifest)) as typeof record, manifest, now);
    expect(JSON.stringify(record)).not.toContain("access_token");
    expect(JSON.stringify(record)).not.toContain("refresh_token");
    expect(JSON.stringify(record)).not.toContain("password");
  });

  it("moves verifier into closure and commits a nonsecret marker before exchange", async () => {
    const { manifest } = await makeManifest();
    const storage = new MemoryStorage();
    const key = continuationKey(manifest);
    const now = Date.now();
    const original = await createContinuation(manifest, now);
    const verifier = original.codeVerifier;
    const sent = markRecoverySent(storage, key, original);
    const authority = commitExchange(storage, key, sent, manifest, "55555555-5555-4555-8555-555555555555", now + 1);
    expect(authority.codeVerifier).toBe(verifier);
    expect(sent.codeVerifier).toBe("");
    const marker = readRecord(storage, key);
    expect(marker?.kind).toBe("terminal");
    expect(JSON.stringify(marker)).not.toContain(verifier);
    expect(JSON.stringify(marker)).not.toContain(authority.authCode);
  });

  it("reload sees a terminal marker and never continuation authority", async () => {
    const { manifest } = await makeManifest();
    const storage = new MemoryStorage();
    const record = await createContinuation(manifest, Date.now());
    const key = continuationKey(manifest);
    writeAndVerify(storage, key, record);
    replaceWithTerminal(storage, key, manifest, record.transactionBindingSha256, "EXCHANGE_UNCERTAIN", Date.now());
    expect(readRecord(storage, key)).toMatchObject({ kind: "terminal", terminalReason: "EXCHANGE_UNCERTAIN" });
  });

  it("rejects stale, wrong-run, wrong-fixture, and wrong-phase records", async () => {
    const { manifest } = await makeManifest();
    const now = Date.now();
    const record = await createContinuation(manifest, now);
    expect(() => validateContinuation(record, manifest, now + 240000)).toThrow(/expired/u);
    record.runId = "66666666-6666-4666-8666-666666666666";
    expect(() => validateContinuation(record, manifest, now)).toThrow(/binding/u);
    record.runId = manifest.runId;
    record.fixtureBindingSha256 = "f".repeat(64);
    expect(() => validateContinuation(record, manifest, now)).toThrow(/binding/u);
  });

  it("fails closed when storage cannot verify a write", async () => {
    const { manifest } = await makeManifest();
    const record = await createContinuation(manifest, Date.now());
    const broken = new MemoryStorage();
    broken.setItem = () => undefined;
    expect(() => writeAndVerify(broken, continuationKey(manifest), record)).toThrow(/verification/u);
  });

  it("cannot exchange before a definitive recovery response", async () => {
    const { manifest } = await makeManifest();
    const record = await createContinuation(manifest, Date.now());
    expect(() =>
      commitExchange(
        new MemoryStorage(),
        continuationKey(manifest),
        record,
        manifest,
        "77777777-7777-4777-8777-777777777777",
        Date.now(),
      ),
    ).toThrow(/not confirmed/u);
  });
});
