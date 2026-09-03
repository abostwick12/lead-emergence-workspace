import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ProfessionalContextRequestError,
  assertFirstPartyProfessionalContextMutation,
  createProfessionalContextCsrfToken,
  professionalContextCsrfCookieOptions,
} from "@/lib/workspace/professional-context-security";

function mutationRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/workspace/professional-context/confirmations/request-id", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
  });
}

describe("Professional Context first-party confirmation boundary", () => {
  it("accepts a matching HttpOnly-cookie CSRF token from the exact Workspace origin", () => {
    expect(() => assertFirstPartyProfessionalContextMutation(mutationRequest(), "token", "token")).not.toThrow();
  });

  it.each([
    ["bearer authorization", { authorization: "Bearer token" }, "token", "token", 403],
    ["cross-origin request", { origin: "https://attacker.invalid" }, "token", "token", 403],
    ["cross-site fetch", { "sec-fetch-site": "cross-site" }, "token", "token", 403],
    ["non-JSON body", { "content-type": "text/plain" }, "token", "token", 415],
    ["missing CSRF cookie", {}, "token", undefined, 403],
    ["mismatched CSRF token", {}, "submitted", "cookie", 403],
  ])("rejects %s", (_name, headers, submitted, cookie, status) => {
    try {
      assertFirstPartyProfessionalContextMutation(mutationRequest(headers), submitted, cookie);
      throw new Error("expected first-party validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ProfessionalContextRequestError);
      expect((error as ProfessionalContextRequestError).status).toBe(status);
    }
  });

  it("issues high-entropy tokens and a strict, scoped, short-lived cookie", () => {
    const first = createProfessionalContextCsrfToken();
    const second = createProfessionalContextCsrfToken();
    expect(first).toHaveLength(43);
    expect(first).not.toBe(second);
    expect(professionalContextCsrfCookieOptions("/workspace/review/123")).toMatchObject({
      httpOnly: true,
      sameSite: "strict",
      path: "/workspace/review/123",
      maxAge: 30 * 60,
      priority: "high",
    });
  });
});
