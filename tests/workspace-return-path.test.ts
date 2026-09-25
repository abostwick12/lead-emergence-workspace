import { describe, expect, it } from "vitest";

import { normalizeWorkspaceReturnPath, workspaceLoginHref } from "@/lib/workspace/return-path";

describe("Workspace post-login return path", () => {
  const authorizationId = "11111111-1111-4111-8111-111111111111";
  const consentPath = `/oauth/consent?authorization_id=${authorizationId}`;

  it.each([
    "/workspace",
    "/workspace/tasks",
    "/workspace/career",
    "/workspace/memory",
    "/workspace/integrations",
    "/workspace/capture",
    "/workspace/settings"
  ])("preserves approved Workspace paths: %s", (path) => {
    expect(normalizeWorkspaceReturnPath(path)).toBe(path);
  });

  it("drops query and fragment data", () => {
    expect(normalizeWorkspaceReturnPath("/workspace/tasks?legacy_id=123#private")).toBe("/workspace/tasks");
    expect(workspaceLoginHref("/workspace/tasks?legacy_id=123")).toBe("/login?next=%2Fworkspace%2Ftasks");
  });

  it("preserves only an exact OAuth consent continuation through each sign-in normalization", () => {
    const loginHref = workspaceLoginHref(consentPath);
    expect(loginHref).toBe(`/login?next=${encodeURIComponent(consentPath)}`);
    const loginNext = normalizeWorkspaceReturnPath(new URL(loginHref, "https://workspace.leademergence.com").searchParams.get("next"));
    const entryHref = `/auth/entry?next=${encodeURIComponent(loginNext)}`;
    const entryNext = normalizeWorkspaceReturnPath(new URL(entryHref, "https://workspace.leademergence.com").searchParams.get("next"));
    expect(normalizeWorkspaceReturnPath(entryNext)).toBe(consentPath);
  });

  it.each([
    "/oauth/consent",
    "/oauth/consent?authorization_id=",
    "/oauth/consent?authorization_id=not-a-uuid",
    "/oauth/consent?authorization_id=11111111-1111-1111-8111-111111111111",
    "/oauth/consent?authorization_id=11111111-1111-4111-1111-111111111111",
    `/oauth/consent?authorization_id=${authorizationId}&next=/workspace`,
    `/oauth/consent?next=/workspace&authorization_id=${authorizationId}`,
    `/oauth/consent?authorization_id=${authorizationId}#fragment`,
    `/oauth/consent?authorization_id=${authorizationId}&authorization_id=${authorizationId}`,
    `/oauth/other?authorization_id=${authorizationId}`,
    `//evil.example/oauth/consent?authorization_id=${authorizationId}`,
    `https://evil.example/oauth/consent?authorization_id=${authorizationId}`
  ])("rejects non-exact OAuth continuations: %s", (path) => {
    expect(normalizeWorkspaceReturnPath(path)).toBe("/workspace");
  });

  it.each([
    undefined,
    null,
    "",
    "workspace",
    "/workspaces",
    "/workspace-evil",
    "https://evil.example",
    "//evil.example",
    "\\\\evil.example",
    "/%2f%2fevil.example",
    "%2F%2Fevil.example",
    "/workspace/%2e%2e//evil.example",
    "/workspace/%252e%252e/evil",
    "/workspace\\evil",
    "/workspace\u0000evil",
    "/outside"
  ])("defaults hostile or invalid input: %s", (path) => {
    expect(normalizeWorkspaceReturnPath(path)).toBe("/workspace");
  });
});
