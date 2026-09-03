import { describe, expect, it } from "vitest";
import {
  activeProfessionalContextReadGrants,
  assistantConnectionLabel,
  professionalContextGrantMutationSchema,
} from "@/lib/workspace/professional-context-read-grants";

const csrfToken = "c".repeat(43);

describe("Professional Context protected-read controls", () => {
  it.each(["private", "sensitive"] as const)("accepts an explicit %s grant without implying the other scope", (privacyScope) => {
    expect(professionalContextGrantMutationSchema.parse({
      action: "grant",
      clientId: "workspace-client-123",
      privacyScope,
      csrfToken,
    })).toMatchObject({ action: "grant", privacyScope });
  });

  it("accepts only a grant identifier for revocation", () => {
    expect(professionalContextGrantMutationSchema.parse({
      action: "revoke",
      grantId: "b1000000-0000-4000-8000-000000000001",
      csrfToken,
    })).toMatchObject({ action: "revoke" });
  });

  it.each([
    { action: "grant", clientId: "workspace-client-123", privacyScope: "private", csrfToken, userId: "attacker" },
    { action: "grant", clientId: "workspace-client-123", privacyScope: "private", csrfToken, workspaceId: "attacker" },
    { action: "revoke", grantId: "b1000000-0000-4000-8000-000000000001", csrfToken, clientId: "substitute" },
  ])("rejects client-supplied identity or authority fields", (input) => {
    expect(() => professionalContextGrantMutationSchema.parse(input)).toThrow();
  });

  it("reports only unexpired grants that the database marks active", () => {
    const grants = activeProfessionalContextReadGrants({ grants: [
      {
        grant_id: "b1000000-0000-4000-8000-000000000001",
        client_id: "workspace-client-123",
        privacy_scope: "private",
        issued_at: "2026-09-03T11:50:00.000Z",
        expires_at: "2026-09-03T12:10:00.000Z",
        status: "active",
      },
      {
        grant_id: "b1000000-0000-4000-8000-000000000002",
        client_id: "workspace-client-123",
        privacy_scope: "sensitive",
        issued_at: "2026-09-03T11:50:00.000Z",
        expires_at: "2026-09-03T11:59:59.000Z",
        status: "active",
      },
      {
        grant_id: "b1000000-0000-4000-8000-000000000003",
        client_id: "workspace-client-123",
        privacy_scope: "sensitive",
        issued_at: "2026-09-03T11:50:00.000Z",
        expires_at: "2026-09-03T12:05:00.000Z",
        status: "revoked",
      },
    ] }, new Date("2026-09-03T12:00:00.000Z"));

    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ privacy_scope: "private", status: "active" });
  });

  it("uses canonical provider data and a bounded client suffix for a human-readable connection label", () => {
    expect(assistantConnectionLabel({
      id: "authorization-id",
      clientId: "workspace-client-12345678",
      assistantProvider: "chatgpt",
    })).toBe("ChatGPT connection · 12345678");
  });
});
