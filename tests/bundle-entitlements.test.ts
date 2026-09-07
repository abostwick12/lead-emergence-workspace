import { describe, expect, it } from "vitest";
import {
  bundleAssignmentInput,
  bundleEntitlementRevocationInput,
  bundleInviteClaimInput,
  bundleInviteInput
} from "@/lib/workspace/bundle-contract";

describe("bundle product contracts", () => {
  it("accepts generic operator assignment input for the SOTF catalog key", () => {
    expect(bundleAssignmentInput.parse({
      workspaceId: "82aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      bundleKey: "sotf_transition",
      idempotencyKey: "founder-grant-001",
      expiresAt: null
    })).toMatchObject({ bundleKey: "sotf_transition", expiresAt: null });
  });

  it("normalizes invite email while preserving the generic bundle key", () => {
    expect(bundleInviteInput.parse({
      recipientEmail: " Pilot.User@Example.com ",
      bundleKey: "sotf_transition",
      idempotencyKey: "pilot-invite-001"
    }).recipientEmail).toBe("pilot.user@example.com");
  });

  it("rejects malformed or under-bounded assignment, invite, claim, and revocation input", () => {
    expect(bundleAssignmentInput.safeParse({ workspaceId: "not-a-uuid", bundleKey: "SOTF", idempotencyKey: "short" }).success).toBe(false);
    expect(bundleInviteInput.safeParse({ recipientEmail: "not-email", bundleKey: "sotf_transition", idempotencyKey: "short" }).success).toBe(false);
    expect(bundleInviteClaimInput.safeParse({ token: "too-short" }).success).toBe(false);
    expect(bundleEntitlementRevocationInput.safeParse({ entitlementId: crypto.randomUUID(), reason: "no" }).success).toBe(false);
  });

  it("accepts a bounded opaque invite token and auditable revocation reason", () => {
    expect(bundleInviteClaimInput.parse({ token: "bi1.0123456789012345678901234567890123456789012" }).token).toMatch(/^bi1\./);
    expect(bundleEntitlementRevocationInput.parse({
      entitlementId: "82dddddd-dddd-4ddd-8ddd-dddddddddddd",
      reason: "Pilot access ended."
    }).reason).toBe("Pilot access ended.");
  });
});
