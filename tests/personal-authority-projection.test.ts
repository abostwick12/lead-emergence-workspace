import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createPersonalAuthorityProjectionHandler } from "../supabase/functions/personal-authority-projection/handler";

const secret = "slice-d-local-test-secret-with-32-characters";
const now = Date.parse("2026-09-19T18:00:00.000Z");
const timestamp = String(Math.floor(now / 1000));
const envelope = {
  protocol_version: "1",
  delivery_id: "00000000-0000-4000-8000-0000000000d1",
  projection_kind: "BILLING",
  projection_version: 11,
  canonical_user_id: "00000000-0000-4000-8000-0000000000a1",
  projected_at: "2026-09-19T17:59:59.000Z",
  projection_data: {
    effective_state: "ACTIVE",
    trial_started_at: null,
    trial_ends_at: null,
    current_period_started_at: null,
    current_period_ends_at: null,
    grace_until: null,
    cancel_at_period_end: false,
    payment_method_required: false,
  },
} as const;

function signature(rawBody: string, signedTimestamp = timestamp) {
  return `v1=${createHmac("sha256", secret).update(`${signedTimestamp}.${rawBody}`).digest("hex")}`;
}

function signedRequest(rawBody: string, signedTimestamp = timestamp, signedSignature = signature(rawBody, signedTimestamp)) {
  return new Request("http://localhost/functions/v1/personal-authority-projection", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-le-projection-timestamp": signedTimestamp,
      "x-le-projection-signature": signedSignature,
    },
    body: rawBody,
  });
}

describe("PERSONAL authority projection Edge Function", () => {
  it("accepts a valid HMAC request and invokes only the fixed projection contract", async () => {
    const apply = vi.fn().mockResolvedValue({ projection_result: "APPLIED" });
    const handler = createPersonalAuthorityProjectionHandler({ secret, apply, now: () => now });
    const response = await handler(signedRequest(JSON.stringify(envelope)));
    expect(response.status).toBe(200);
    expect(apply).toHaveBeenCalledOnce();
    expect(apply).toHaveBeenCalledWith(envelope);
  });

  it("rejects a missing signature", async () => {
    const handler = createPersonalAuthorityProjectionHandler({ secret, apply: vi.fn(), now: () => now });
    const response = await handler(new Request("http://localhost", {
      method: "POST",
      headers: { "x-le-projection-timestamp": timestamp },
      body: JSON.stringify(envelope),
    }));
    expect(response.status).toBe(401);
  });

  it("rejects an invalid signature", async () => {
    const handler = createPersonalAuthorityProjectionHandler({ secret, apply: vi.fn(), now: () => now });
    const response = await handler(signedRequest(JSON.stringify(envelope), timestamp, `v1=${"0".repeat(64)}`));
    expect(response.status).toBe(401);
  });

  it("rejects body tampering", async () => {
    const original = JSON.stringify(envelope);
    const tampered = original.replace('"ACTIVE"', '"CANCELED"');
    const handler = createPersonalAuthorityProjectionHandler({ secret, apply: vi.fn(), now: () => now });
    const response = await handler(signedRequest(tampered, timestamp, signature(original)));
    expect(response.status).toBe(401);
  });

  it.each([
    ["older", String(Number(timestamp) - 301)],
    ["future", String(Number(timestamp) + 301)],
  ])("rejects a timestamp excessively %s", async (_label, rejectedTimestamp) => {
    const body = JSON.stringify(envelope);
    const handler = createPersonalAuthorityProjectionHandler({ secret, apply: vi.fn(), now: () => now });
    const response = await handler(signedRequest(body, rejectedTimestamp));
    expect(response.status).toBe(401);
  });

  it("validates payload only after successful authentication", async () => {
    const rawBody = "not-json";
    const handler = createPersonalAuthorityProjectionHandler({ secret, apply: vi.fn(), now: () => now });
    const unsigned = await handler(new Request("http://localhost", { method: "POST", body: rawBody }));
    const signed = await handler(signedRequest(rawBody));
    expect(unsigned.status).toBe(401);
    expect(signed.status).toBe(400);
  });

  it("rejects arbitrary RPC selection fields", async () => {
    const rawBody = JSON.stringify({ ...envelope, rpc_name: "delete_everything" });
    const apply = vi.fn();
    const handler = createPersonalAuthorityProjectionHandler({ secret, apply, now: () => now });
    const response = await handler(signedRequest(rawBody));
    expect(response.status).toBe(400);
    expect(apply).not.toHaveBeenCalled();
  });

  it("rejects Stripe identifiers and other non-normalized fields", async () => {
    const rawBody = JSON.stringify({
      ...envelope,
      projection_data: { ...envelope.projection_data, stripe_customer_id: "cus_forbidden" },
    });
    const handler = createPersonalAuthorityProjectionHandler({ secret, apply: vi.fn(), now: () => now });
    expect((await handler(signedRequest(rawBody))).status).toBe(400);
  });

  it("keeps the HMAC secret and Workspace service role out of browser runtime configuration", () => {
    const workspaceEnvironment = readFileSync(".env.example", "utf8");
    const entryEnvironment = readFileSync("landing-hero-repair/.env.example", "utf8");
    expect(workspaceEnvironment).not.toContain("WORKSPACE_PROJECTION_HMAC_SECRET");
    expect(workspaceEnvironment).not.toMatch(/^SUPABASE_SERVICE_ROLE_KEY=/m);
    expect(entryEnvironment).toContain("WORKSPACE_PROJECTION_HMAC_SECRET=");
    expect(entryEnvironment).not.toContain("NEXT_PUBLIC_WORKSPACE_PROJECTION_HMAC_SECRET");
  });

  it("does not provide a Stripe secret to the Edge Function", () => {
    const edgeSource = readFileSync("supabase/functions/personal-authority-projection/index.ts", "utf8");
    expect(edgeSource).not.toContain("STRIPE_SECRET");
    expect(edgeSource).not.toContain("STRIPE_WEBHOOK");
  });
});
