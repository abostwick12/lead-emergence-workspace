import { describe, expect, it, vi } from "vitest";
import {
  assertApprovedRequest,
  buildEmailChangeRequest,
  buildExchangeRequest,
  buildPasswordChangeRequest,
  buildRecoveryRequest,
  sendExactlyOnce,
} from "../src/request-contract";
import { makeManifest } from "./helpers";

const AUTH_CODE = "88888888-8888-4888-8888-888888888888";
const VERIFIER = "A".repeat(86);
const CHALLENGE = "B".repeat(43);
const ACCESS_TOKEN = "synthetic-access-token-value-that-is-long-enough";

describe("exact request contract", () => {
  it("builds the exact recovery request", async () => {
    const { manifest } = await makeManifest();
    const request = buildRecoveryRequest(manifest, CHALLENGE);
    expect(request).toMatchObject({ operation: "RECOVERY", init: { method: "POST", credentials: "omit", redirect: "error", keepalive: false } });
    expect(request.url).toBe(`${manifest.authBaseUrl}/recover?redirect_to=${encodeURIComponent(manifest.callbackUrl)}`);
    expect(JSON.parse(request.init.body as string)).toEqual({
      email: manifest.fixture.currentEmail,
      code_challenge: CHALLENGE,
      code_challenge_method: "s256",
    });
    expect(request.init.headers).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
      apikey: manifest.publicKey,
      Authorization: `Bearer ${manifest.publicKey}`,
    });
  });

  it("builds the exact PKCE exchange request", async () => {
    const { manifest } = await makeManifest();
    const request = buildExchangeRequest(manifest, AUTH_CODE, VERIFIER);
    expect(request.url).toBe(`${manifest.authBaseUrl}/token?grant_type=pkce`);
    expect(JSON.parse(request.init.body as string)).toEqual({ auth_code: AUTH_CODE, code_verifier: VERIFIER });
  });

  it("pins the callback on email change and adds no PKCE", async () => {
    const { manifest } = await makeManifest();
    const request = buildEmailChangeRequest(manifest, ACCESS_TOKEN);
    expect(request.url).toBe(`${manifest.authBaseUrl}/user?redirect_to=${encodeURIComponent(manifest.callbackUrl)}`);
    expect(JSON.parse(request.init.body as string)).toEqual({ email: manifest.fixture.newEmail });
    expect(request.init.headers).toMatchObject({ Authorization: `Bearer ${ACCESS_TOKEN}` });
    expect(request.init.body).not.toContain("code_challenge");
  });

  it("builds password update with no probe, reauth, refresh, or logout field", async () => {
    const { manifest } = await makeManifest();
    const request = buildPasswordChangeRequest(manifest, ACCESS_TOKEN, "synthetic-password-canary");
    expect(request.url).toBe(`${manifest.authBaseUrl}/user`);
    expect(JSON.parse(request.init.body as string)).toEqual({ password: "synthetic-password-canary" });
    expect(request.init.body).not.toContain("current_password");
    expect(request.init.body).not.toContain("nonce");
  });

  it("uses the exact same original token across both mutations", async () => {
    const { manifest } = await makeManifest();
    const email = buildEmailChangeRequest(manifest, ACCESS_TOKEN);
    const password = buildPasswordChangeRequest(manifest, ACCESS_TOKEN, "synthetic-password-canary");
    expect((email.init.headers as Record<string, string>).Authorization).toBe((password.init.headers as Record<string, string>).Authorization);
  });

  it("calls fetch exactly once and never retries a rejection", async () => {
    const { manifest } = await makeManifest();
    const request = buildRecoveryRequest(manifest, CHALLENGE);
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("synthetic lost response"));
    await expect(sendExactlyOnce(fetcher, manifest, request)).rejects.toThrow(/lost response/u);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects destination and operation substitution", async () => {
    const { manifest } = await makeManifest();
    const request = buildRecoveryRequest(manifest, CHALLENGE);
    expect(() => assertApprovedRequest(manifest, { ...request, url: "https://example.invalid/recover" })).toThrow(/shape/u);
    expect(() => assertApprovedRequest(manifest, { ...request, operation: "PASSWORD_CHANGE" })).toThrow(/denied|shape/u);
  });

  it("rejects header, body, transport, and extra-init substitution", async () => {
    const { manifest } = await makeManifest();
    const request = buildRecoveryRequest(manifest, CHALLENGE);
    const body = JSON.stringify({ email: manifest.fixture.newEmail, code_challenge: CHALLENGE, code_challenge_method: "s256" });
    expect(() => assertApprovedRequest(manifest, { ...request, init: { ...request.init, body } })).toThrow(/shape/u);
    expect(() => assertApprovedRequest(manifest, { ...request, init: { ...request.init, credentials: "include" } })).toThrow(/transport/u);
    expect(() => assertApprovedRequest(manifest, { ...request, init: { ...request.init, priority: "high" } })).toThrow(/init shape/u);
    expect(() =>
      assertApprovedRequest(manifest, {
        ...request,
        init: { ...request.init, headers: { ...(request.init.headers as Record<string, string>), "X-Debug": "true" } },
      }),
    ).toThrow(/header shape/u);
  });

  it("rejects malformed credential and PKCE material", async () => {
    const { manifest } = await makeManifest();
    expect(() => buildRecoveryRequest(manifest, "bad")).toThrow();
    expect(() => buildExchangeRequest(manifest, "bad", VERIFIER)).toThrow();
    expect(() => buildEmailChangeRequest(manifest, "short")).toThrow();
    expect(() => buildPasswordChangeRequest(manifest, ACCESS_TOKEN, "")).toThrow();
  });
});
