import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const fixture = vi.hoisted(() => ({ entitlement: {} as Record<string, unknown> }));
vi.mock("@/lib/workspace/bundle-server", () => ({
  readBearerToken: vi.fn(() => "synthetic-session"),
  authenticatedBundleClient: vi.fn(async () => ({ client: {} })),
  bundleRpc: vi.fn(async () => fixture.entitlement),
  bundleErrorResponse: vi.fn(() => Response.json({ message: "Could not resolve this bundle." }, { status: 400 }))
}));

import { GET } from "@/app/api/workspaces/[workspaceId]/bundles/[bundleKey]/route";

const workspaceId = "70000000-0000-4000-8000-000000000001";
const request = (bundleKey: string) => GET(
  new Request(`http://localhost/api/workspaces/${workspaceId}/bundles/${bundleKey}`),
  { params: Promise.resolve({ workspaceId, bundleKey }) }
);

beforeEach(() => {
  fixture.entitlement = {
    bundle_key: "sotf_transition",
    state: "active",
    entitled: true
  };
});

describe("SOTF exact release delivery", () => {
  it("returns the validated 1.0.0 artifact only after an active SOTF entitlement", async () => {
    const response = await request("sotf_transition");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.release).toMatchObject({
      bundleKey: "sotf_transition",
      version: "1.0.0",
      artifactDigest: "sha256:ab62f775b6662b1d4e9d15390aed41aaa6aeb6efd0cd8b965b255177609d0323",
      sourceRevision: "70f6d14f25b391ea319080e6701e5fe74d1785a5",
      manifest: { identity: { key: "sotf_transition", version: "1.0.0" } },
      uiManifest: { bundleKey: "sotf_transition" }
    });
  });

  it("does not return a release for an inactive or mismatched entitlement", async () => {
    fixture.entitlement = { bundle_key: "sotf_transition", state: "available", entitled: false };
    expect(await (await request("sotf_transition")).json()).not.toHaveProperty("release");

    fixture.entitlement = { bundle_key: "other_bundle", state: "active", entitled: true };
    expect(await (await request("sotf_transition")).json()).not.toHaveProperty("release");
  });

  it("preserves the existing response for other bundle keys", async () => {
    fixture.entitlement = { bundle_key: "other_bundle", state: "active", entitled: true };
    expect(await (await request("other_bundle")).json()).toEqual({ entitlement: fixture.entitlement });
  });
});
