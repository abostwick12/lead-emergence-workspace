import { describe, expect, it } from "vitest";

import { verifyEntryProviderIdentity } from "@/lib/auth/entry-identity";

const provider = "custom:lead-emergence-entry-workspace-acceptance";
const subject = "81111111-1111-4111-8111-111111111111";
const identityRowId = "8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("Entry OIDC identity mapping", () => {
  it("uses the API's subject alias, not its generated identity-row UUID", () => {
    // Supabase Auth serializes auth.identities.provider_id as UserIdentity.id
    // for client compatibility. The generated auth.identities.id is exposed as
    // UserIdentity.identity_id. The names are counterintuitive but material.
    const identity = {
      provider,
      id: subject,
      identity_id: identityRowId,
      user_id: "82222222-2222-4222-8222-222222222222",
      identity_data: { sub: subject }
    };

    expect(identity.id).toBe(identity.identity_data.sub);
    expect(identity.identity_id).not.toBe(identity.identity_data.sub);
    expect(verifyEntryProviderIdentity({ identities: [identity] } as never, provider)).toEqual({
      canonicalUserId: subject,
      providerIdentifier: provider
    });
  });

  it("does not compare the trusted provider identifier to the UUID subject", () => {
    const identity = {
      provider,
      id: subject,
      identity_id: identityRowId,
      user_id: "82222222-2222-4222-8222-222222222222",
      identity_data: { sub: subject }
    };

    expect(identity.provider).not.toBe(identity.identity_data.sub);
    expect(verifyEntryProviderIdentity({ identities: [identity] } as never, provider).canonicalUserId).toBe(subject);
  });

  it("rejects a provider-subject mismatch even when the identity-row UUID is arbitrary", () => {
    const identity = {
      provider,
      id: "83333333-3333-4333-8333-333333333333",
      identity_id: identityRowId,
      user_id: "82222222-2222-4222-8222-222222222222",
      identity_data: { sub: subject }
    };

    expect(() => verifyEntryProviderIdentity({ identities: [identity] } as never, provider)).toThrow("subject is invalid");
  });
});