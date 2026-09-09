import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { composeBundleExperience, type BundleAuthority } from "@/lib/bundles/experience";
import { resolveBundleExperience } from "@/lib/bundles/server";
import { createWorkspaceMcpServer } from "@/lib/workspace/mcp-server";
import { reviewResource } from "@/lib/writing/review";
import { resourceDetail, resourceSearch, safeSourceUrl } from "@/lib/writing/contracts";
import sourceLock from "@/vendor/lead-emergence-bundles/source-lock.json";

const authority: BundleAuthority = {
  schemaVersion: "1.0", subjectId: "71000000-0000-4000-8000-000000000001",
  workspaceId: "72000000-0000-4000-8000-000000000001",
  revision: "revision-one", resolvedAt: "2026-09-08T18:00:00Z",
  assignments: [{ bundleKey: "writer_editor", status: "active", startsAt: "2026-09-01T00:00:00Z", expiresAt: null }],
  capabilities: [{ bundleKey: "writer_editor", capabilityId: "writer.resource.library" }, { bundleKey: "writer_editor", capabilityId: "writer.resource.review" }]
};
const closers: Array<{ close: () => Promise<void> }> = [];
afterEach(async () => { await Promise.all(closers.splice(0).map((item) => item.close())); });

describe("Writer platform integration", () => {
  it("uses an intact, pinned export of the reusable platform", () => {
    expect(sourceLock.sourceRevision).toMatch(/^[a-f0-9]{40}$/);
    for (const file of sourceLock.files) {
      const content = readFileSync(resolve("vendor/lead-emergence-bundles", file.outputPath));
      expect(createHash("sha256").update(content).digest("hex"), file.outputPath).toBe(file.sha256);
    }
  });
  it("composes Writing UI and only database-enabled capabilities", () => {
    const result = composeBundleExperience(authority);
    expect(result.ui.primaryNavigation.map((item) => item.label)).toEqual(["Writing"]);
    expect(result.ui.dashboardWidgets.map((item) => item.id)).toEqual(["writer.widget.publication_queue"]);
    expect(result.capabilityIds).toEqual(["writer.resource.library", "writer.resource.review"]);
    expect(result.capabilityIds).not.toContain("writer.wix.propose_changes");
    const restricted = composeBundleExperience({ ...authority, capabilities: [authority.capabilities[1]] });
    expect(restricted.ui.dashboardWidgets).toEqual([]);
    expect(restricted.ui.primaryNavigation).toEqual([]);
    expect(restricted.ui.defaultWorkspaceRoute).toBeUndefined();
    const unavailable = composeBundleExperience({ ...authority, capabilities: [] });
    expect(unavailable.ui.emptyStates).toEqual([]);
    expect(unavailable.ui.bundleSettings).toEqual([]);
  });
  it("removes all Writing surfaces when the grant is removed or future dated", () => {
    for (const assignments of [[], [{ ...authority.assignments[0], status: "revoked" }], [{ ...authority.assignments[0], startsAt: "2027-01-01T00:00:00Z" }]]) {
      const result = composeBundleExperience({ ...authority, assignments });
      expect(result.ui.primaryNavigation).toEqual([]);
      expect(result.ui.dashboardWidgets).toEqual([]);
      expect(result.capabilityIds).toEqual([]);
    }
  });
  it("rejects an RPC identity that differs from the verified bearer", async () => {
    const rpc = vi.fn(async () => ({ data: authority, error: null }));
    await expect(resolveBundleExperience({ rpc } as never, "73000000-0000-4000-8000-000000000001")).rejects.toThrow();
    rpc.mockResolvedValueOnce({ data: { ...authority, capabilities: null } as never, error: null });
    await expect(resolveBundleExperience({ rpc } as never, authority.subjectId)).rejects.toThrow();
  });
  it("exposes Writer discovery only for admitted capabilities and rechecks calls", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "42501" } }));
    const [c, s] = InMemoryTransport.createLinkedPair();
    const server = createWorkspaceMcpServer({ rpc } as never, undefined, {
      bundleCapabilityIds: composeBundleExperience(authority).capabilityIds
    });
    const client = new Client({ name: "writer-protocol-unit", version: "1" });
    await server.connect(s); await client.connect(c); closers.push(client, server);
    const tools = (await client.listTools()).tools.filter((tool) => tool.name.startsWith("writer_"));
    expect(tools.map((tool) => tool.name).sort()).toEqual(["writer_find_connections", "writer_list_resources", "writer_prepare_publication", "writer_review_resource"]);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint)).toBe(true);
    expect((await client.listPrompts()).prompts.map((prompt) => prompt.name)).toContain("writer_resource_review");
    const denied = await client.callTool({ name: "writer_review_resource", arguments: { resource_id: "74000000-0000-4000-8000-000000000001" } });
    expect(denied.isError).toBe(true);
    expect(rpc).toHaveBeenCalledWith("writer_get_resource", { resource_id: "74000000-0000-4000-8000-000000000001" });
  });
  it("rejects tenant overrides, oversized searches, and executable source links", () => {
    expect(resourceSearch.safeParse({ workspaceId: authority.workspaceId }).success).toBe(false);
    expect(resourceSearch.safeParse({ limit: 500 }).success).toBe(false);
    expect(safeSourceUrl("javascript:alert(1)")).toBeNull();
    expect(safeSourceUrl("https://user:password@example.com")).toBeNull();
    expect(safeSourceUrl("https://example.com/resource")).toBe("https://example.com/resource");
  });
  it("reports recorded gaps without converting inference into fact or approval", () => {
    const resource = resourceDetail.parse({
      id: "74000000-0000-4000-8000-000000000001", title: "Synthetic manuscript", author: null, resource_type: "article",
      audience: null, topics: [], abstract: null, body_text: "A brief fictional source.", revision: 1, metadata: {},
      source_url: null, source_label: "Synthetic fixture", source_date: null,
      retrieved_at: authority.resolvedAt, epistemic_state: "inferred", publication_state: "ready", updated_at: authority.resolvedAt
    });
    const review = reviewResource(resource);
    expect(review.findings[0].field).toBe("Evidence status");
    expect(review.findings.map((item) => item.field)).toContain("Author");
    expect(review.publicationDecision).toContain("Human review required");
    expect(resource.epistemic_state).toBe("inferred");
    expect(resource.publication_state).toBe("ready");
  });
});
