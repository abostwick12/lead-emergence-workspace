import type { User } from "@supabase/supabase-js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ENTRY_SIGN_IN_COOKIE = "le_workspace_entry_sign_in";
export const ENTRY_RETURN_COOKIE = "le_workspace_entry_return";

export function requireEntryProviderIdentifier(value = process.env.ENTRY_OIDC_PROVIDER) {
  if (!value || !/^custom:[a-z0-9][a-z0-9:-]{1,49}$/.test(value)) {
    throw new Error("Lead Emergence Entry sign-in is not configured.");
  }
  return value;
}

export function verifyEntryProviderIdentity(user: User, providerIdentifier = requireEntryProviderIdentifier()) {
  const matches = (user.identities ?? []).filter((identity) => identity.provider === providerIdentifier);
  if (matches.length !== 1) throw new Error("A single verified Lead Emergence Entry identity is required.");
  const identity = matches[0];
  const subject = (identity.identity_data as Record<string, unknown>).sub;
  if (typeof subject !== "string" || !UUID.test(subject) || identity.id !== subject) {
    throw new Error("The Lead Emergence Entry identity subject is invalid.");
  }
  return { canonicalUserId: subject, providerIdentifier };
}

export function entryCookieOptions(path = "/") {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path, maxAge: 600 };
}
