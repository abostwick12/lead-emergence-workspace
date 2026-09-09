import { describe, expect, it } from "vitest";
import { taskTargetFromHash, taskTargetId, type TaskTargetKind } from "@/lib/bundles/task-target";
import { sourceRoute } from "@/lib/executive-bundle/presentation";
import { executiveTaskKinds } from "@/lib/executive-bundle/contracts";

const id = "A8000000-0000-4000-8000-000000000001";
describe("Exact source task links", () => {
  for (const [capabilityId, parents] of Object.entries(executiveTaskKinds)) {
    for (const [kind, items] of Object.entries(parents)) {
      for (const itemKind of items) {
        it("targets " + capabilityId + "/" + kind + "/" + itemKind, () => {
          const route = sourceRoute({ capabilityId, kind, documentId: id, revision: 1, item: {kind: itemKind as TaskTargetKind, id} });
          expect(route).toContain("/" + kind + "/" + id + "#task-" + itemKind + "-" + id.toLowerCase());
          expect(taskTargetFromHash(new URL(route!, "https://example.invalid").hash)).toBe(taskTargetId(itemKind as TaskTargetKind, id));
        });
      }
    }
  }
  it("preserves record-only navigation", () => {
    expect(sourceRoute({ capabilityId: "executive.coordination", kind: "meeting", documentId: id, revision: 2 })).toBe("/workspace/executive/meeting/" + id);
  });
  it("rejects unsupported capability, record and item combinations", () => {
    for (const ref of [
      { capabilityId: "executive.coordination", kind: "commitment", documentId: id, revision: 1, item: {kind: "action" as const, id} },
      { capabilityId: "nonprofit.partners", kind: "partner", documentId: id, revision: 1, item: {kind: "followup" as const, id: "a8000000-0000-4000-8000-000000000002"} },
      { capabilityId: "investor.thesis", kind: "../login", documentId: id, revision: 1 },
      { capabilityId: "executive.coordination", kind: "meeting", documentId: "//example.org", revision: 1 }
    ]) expect(sourceRoute(ref)).toBeNull();
  });
  it("normalizes case and encoded fragments without using arbitrary selectors", () => {
    expect(taskTargetFromHash("#TASK-ACTION-" + id)).toBe(taskTargetId("action", id));
    expect(taskTargetFromHash("#" + encodeURIComponent(taskTargetId("watch_item", id)))).toBe(taskTargetId("watch_item", id));
    for (const hash of ["", "#overview", "#task-action-%", "#task-action-../../login", "#task-action-" + id + "?x=1", "#task-secret-" + id, '#task-action-"] button']) {
      expect(taskTargetFromHash(hash)).toBeNull();
    }
  });
});
