import { describe, expect, it } from "vitest";
import { decryptIntegrationValue, encryptIntegrationValue, secureEquals } from "../lib/integrations/crypto";

describe("integration credential encryption", () => {
  const secret = "integration-test-secret-that-is-long-enough-to-be-safe";

  it("round-trips a private credential only with the exact Workspace and provider binding", () => {
    const ciphertext = encryptIntegrationValue('{"refresh_token":"private"}', secret, "workspace-a:google");
    expect(ciphertext).not.toContain("private");
    expect(decryptIntegrationValue(ciphertext, secret, "workspace-a:google")).toBe('{"refresh_token":"private"}');
    expect(() => decryptIntegrationValue(ciphertext, secret, "workspace-b:google")).toThrow();
  });

  it("uses constant-time comparison only for equal-length values", () => {
    expect(secureEquals("same", "same")).toBe(true);
    expect(secureEquals("same", "other")).toBe(false);
    expect(secureEquals("same", "longer")).toBe(false);
  });
});
