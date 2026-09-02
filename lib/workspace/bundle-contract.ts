import { z } from "zod";

const bundleKey = z.string().trim().regex(/^[a-z][a-z0-9_]{1,49}$/);
const idempotencyKey = z.string().trim().min(8).max(120);
const optionalExpiry = z.string().datetime({ offset: true }).nullable().optional();

export const bundleAssignmentInput = z.object({
  workspaceId: z.string().uuid(),
  bundleKey,
  idempotencyKey,
  expiresAt: optionalExpiry
});

export const bundleInviteInput = z.object({
  recipientEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  bundleKey,
  idempotencyKey,
  expiresAt: optionalExpiry
});

export const bundleInviteClaimInput = z.object({
  token: z.string().trim().min(32).max(512)
});

export const bundleEntitlementRevocationInput = z.object({
  entitlementId: z.string().uuid(),
  reason: z.string().trim().min(5).max(500)
});

export const bundleInviteRevocationInput = z.object({
  inviteId: z.string().uuid(),
  reason: z.string().trim().min(5).max(500)
});

export type BundleEntitlementState = "available" | "active" | "unavailable" | "expired" | "revoked";

export type BundleEntitlementResolution = {
  bundle_key: string;
  display_name: string | null;
  catalog_available: boolean;
  entitled: boolean;
  state: BundleEntitlementState;
  entitlement_id: string | null;
  source?: "operator_assignment" | "invite" | "subscription" | "promotion" | "organization_license" | null;
  starts_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  capabilities?: Array<{ capability_key: string; enabled: boolean; limit_value: number | null }>;
};
