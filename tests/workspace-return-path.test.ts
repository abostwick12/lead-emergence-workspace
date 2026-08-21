import { describe, expect, it } from "vitest";

import { normalizeWorkspaceReturnPath, workspaceLoginHref } from "@/lib/workspace/return-path";

describe("Workspace post-login return path", () => {
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
