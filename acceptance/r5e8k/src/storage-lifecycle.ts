import { canonicalJson, fixedTimeEqual, randomBase64Url, sha256Base64, sha256Hex } from "./crypto";
import type { RunManifest } from "./manifest";

export const TERMINAL_REASONS = [
  "EXCHANGE_COMMITTED",
  "RECOVERY_REQUEST_UNCERTAIN",
  "EXCHANGE_REJECTED",
  "EXCHANGE_UNCERTAIN",
  "INVALID_CALLBACK",
  "WRONG_FIXTURE",
  "EXPIRED",
  "DUPLICATE_CONTEXT",
  "MUTATION_UNCERTAIN",
  "COMPLETE",
] as const;

export type TerminalReason = (typeof TERMINAL_REASONS)[number];

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ContinuationRecord {
  schema: "r5e8c-pkce-continuation/v1";
  kind: "continuation";
  phase: "RECOVERY_SEND_LATCHED" | "RECOVERY_SENT";
  runId: string;
  manifestCoreSha256: string;
  fixtureBindingSha256: string;
  transactionNonce: string;
  transactionBindingSha256: string;
  createdAtEpochMs: number;
  absoluteExpiryEpochMs: number;
  codeVerifier: string;
  codeChallenge: string;
}

export interface TerminalMarker {
  schema: "r5e8c-pkce-terminal/v1";
  kind: "terminal";
  phase: "EXCHANGE_COMMITTED";
  runId: string;
  manifestCoreSha256: string;
  fixtureBindingSha256: string;
  transactionBindingSha256: string;
  terminalReason: TerminalReason;
  terminalAtEpochMs: number;
  markerExpiresAtEpochMs: number;
}

export interface ExchangeAuthority {
  authCode: string;
  codeVerifier: string;
}

export function continuationKey(manifest: RunManifest): string {
  return `r5e8c.pkce.${manifest.manifestCoreSha256}`;
}

export async function createContinuation(manifest: RunManifest, nowEpochMs: number): Promise<ContinuationRecord> {
  const codeVerifier = randomBase64Url(64);
  const codeChallenge = await sha256Base64(codeVerifier);
  const transactionNonce = randomBase64Url(32);
  const transactionBindingSha256 = await sha256Hex(
    canonicalJson({
      runId: manifest.runId,
      manifestCoreSha256: manifest.manifestCoreSha256,
      fixtureBindingSha256: manifest.fixtureBindingSha256,
      transactionNonce,
    }),
  );
  return {
    schema: "r5e8c-pkce-continuation/v1",
    kind: "continuation",
    phase: "RECOVERY_SEND_LATCHED",
    runId: manifest.runId,
    manifestCoreSha256: manifest.manifestCoreSha256,
    fixtureBindingSha256: manifest.fixtureBindingSha256,
    transactionNonce,
    transactionBindingSha256,
    createdAtEpochMs: nowEpochMs,
    absoluteExpiryEpochMs: nowEpochMs + manifest.timing.pkceLifetimeMs,
    codeVerifier,
    codeChallenge,
  };
}

function assertExactKeys(value: object, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error("storage record has unexpected fields");
  }
}

export function validateContinuation(record: ContinuationRecord, manifest: RunManifest, nowEpochMs: number): void {
  assertExactKeys(record, [
    "schema",
    "kind",
    "phase",
    "runId",
    "manifestCoreSha256",
    "fixtureBindingSha256",
    "transactionNonce",
    "transactionBindingSha256",
    "createdAtEpochMs",
    "absoluteExpiryEpochMs",
    "codeVerifier",
    "codeChallenge",
  ]);
  if (record.schema !== "r5e8c-pkce-continuation/v1" || record.kind !== "continuation") {
    throw new Error("invalid continuation schema");
  }
  if (record.phase !== "RECOVERY_SEND_LATCHED" && record.phase !== "RECOVERY_SENT") {
    throw new Error("invalid continuation phase");
  }
  if (
    record.runId !== manifest.runId ||
    !fixedTimeEqual(record.manifestCoreSha256, manifest.manifestCoreSha256) ||
    !fixedTimeEqual(record.fixtureBindingSha256, manifest.fixtureBindingSha256)
  ) {
    throw new Error("continuation binding mismatch");
  }
  if (
    !/^[A-Za-z0-9_-]{86}$/u.test(record.codeVerifier) ||
    !/^[A-Za-z0-9_-]{43}$/u.test(record.codeChallenge) ||
    !/^[A-Za-z0-9_-]{43}$/u.test(record.transactionNonce) ||
    !/^[0-9a-f]{64}$/u.test(record.transactionBindingSha256)
  ) {
    throw new Error("invalid continuation material");
  }
  if (
    record.absoluteExpiryEpochMs !== record.createdAtEpochMs + 240000 ||
    nowEpochMs < record.createdAtEpochMs ||
    nowEpochMs >= record.absoluteExpiryEpochMs
  ) {
    throw new Error("continuation expired");
  }
}

export function writeAndVerify(storage: StorageLike, key: string, value: ContinuationRecord | TerminalMarker): void {
  const serialized = canonicalJson(value);
  storage.setItem(key, serialized);
  const persisted = storage.getItem(key);
  if (persisted === null || !fixedTimeEqual(persisted, serialized)) {
    throw new Error("storage verification failed");
  }
}

export function readRecord(storage: StorageLike, key: string): ContinuationRecord | TerminalMarker | null {
  const serialized = storage.getItem(key);
  if (serialized === null) return null;
  const parsed = JSON.parse(serialized) as ContinuationRecord | TerminalMarker;
  if (parsed.kind !== "continuation" && parsed.kind !== "terminal") throw new Error("unknown storage record");
  return parsed;
}

export function markRecoverySent(storage: StorageLike, key: string, record: ContinuationRecord): ContinuationRecord {
  const updated: ContinuationRecord = { ...record, phase: "RECOVERY_SENT" };
  writeAndVerify(storage, key, updated);
  return updated;
}

export function makeTerminalMarker(
  manifest: RunManifest,
  transactionBindingSha256: string,
  reason: TerminalReason,
  nowEpochMs: number,
): TerminalMarker {
  return {
    schema: "r5e8c-pkce-terminal/v1",
    kind: "terminal",
    phase: "EXCHANGE_COMMITTED",
    runId: manifest.runId,
    manifestCoreSha256: manifest.manifestCoreSha256,
    fixtureBindingSha256: manifest.fixtureBindingSha256,
    transactionBindingSha256,
    terminalReason: reason,
    terminalAtEpochMs: nowEpochMs,
    markerExpiresAtEpochMs: manifest.timing.artifactHardStopEpochMs,
  };
}

export function commitExchange(
  storage: StorageLike,
  key: string,
  record: ContinuationRecord,
  manifest: RunManifest,
  authCode: string,
  nowEpochMs: number,
): ExchangeAuthority {
  validateContinuation(record, manifest, nowEpochMs);
  if (record.phase !== "RECOVERY_SENT") throw new Error("recovery request not confirmed");
  if (!/^[0-9a-f-]{36}$/iu.test(authCode)) throw new Error("invalid authorization code shape");

  const authority: ExchangeAuthority = { authCode, codeVerifier: record.codeVerifier };
  const marker = makeTerminalMarker(manifest, record.transactionBindingSha256, "EXCHANGE_COMMITTED", nowEpochMs);
  writeAndVerify(storage, key, marker);

  record.codeVerifier = "";
  record.codeChallenge = "";
  record.transactionNonce = "";
  return authority;
}

export function replaceWithTerminal(
  storage: StorageLike,
  key: string,
  manifest: RunManifest,
  transactionBindingSha256: string,
  reason: TerminalReason,
  nowEpochMs: number,
): void {
  writeAndVerify(storage, key, makeTerminalMarker(manifest, transactionBindingSha256, reason, nowEpochMs));
}
