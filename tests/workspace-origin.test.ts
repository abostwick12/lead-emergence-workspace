import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { trustedWorkspaceOrigin } from "@/lib/http/origin";

describe("trustedWorkspaceOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the configured stable origin for Vercel Preview callbacks", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "lead-emergence-workspace-random-deployment.vercel.app");
    vi.stubEnv(
      "NEXT_PUBLIC_APP_URL",
      "https://lead-emergence-workspace-git-product-498b3c-emergence-projects.vercel.app"
    );

    expect(trustedWorkspaceOrigin("https://lead-emergence-workspace-random-deployment.vercel.app")).toBe(
      "https://lead-emergence-workspace-git-product-498b3c-emergence-projects.vercel.app"
    );
  });

  it("keeps loopback request origins available during development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://workspace.leademergence.com");

    expect(trustedWorkspaceOrigin("http://localhost:3100")).toBe("http://localhost:3100");
  });
});
