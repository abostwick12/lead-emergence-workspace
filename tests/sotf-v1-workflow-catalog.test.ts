import { describe, expect, it } from "vitest";
import {
  evaluateSotfV1Capabilities,
  evaluateSotfV1HostCapabilities,
  getSotfV1Bundle,
  getSotfV1Workflow,
  listSotfV1Bundles,
  listSotfV1Workflows,
  SOTF_V1_REQUIRED_CAPABILITIES,
} from "@/lib/sotf/workflow-catalog";

describe("SOTF v1 static workflow catalog", () => {
  it("publishes one bootstrap bundle and one hosted Mode A workflow", () => {
    expect(listSotfV1Bundles()).toEqual([expect.objectContaining({
      bundle_key: "sotf_transition",
      bundle_version: "1.0.0",
      le_contract: "sotf_daily_brief_v1",
    })]);
    expect(listSotfV1Workflows("sotf_transition")).toEqual({ ok: true, value: [expect.objectContaining({
      workflow_id: "transition.daily_brief",
      current_version: "1.0.0",
      execution_mode: "A",
    })] });
  });

  it("supports current and exact retrieval without inventing versions or workflows", () => {
    const current = getSotfV1Workflow("transition.daily_brief");
    const exact = getSotfV1Workflow("transition.daily_brief", "1.0.0");
    expect(current).toEqual(exact);
    expect(current).toMatchObject({ ok: true, value: {
      execution_mode: "A",
      supported_hosts: ["chatgpt"],
      allowed_write_backs: ["sotf_record_daily_brief_outcome"],
      output: { persist_brief_text: false },
    } });
    expect(getSotfV1Workflow("transition.weekly_review")).toEqual({ ok: false, code: "not_available" });
    expect(getSotfV1Workflow("transition.daily_brief", "2.0.0")).toEqual({ ok: false, code: "version_not_available" });
    expect(getSotfV1Bundle("unknown")).toEqual({ ok: false, code: "not_available" });
  });

  it("returns defensive copies of immutable checked-in contracts", () => {
    const first = getSotfV1Bundle("sotf_transition");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    first.value.display_name = "mutated by caller";
    const second = getSotfV1Bundle("sotf_transition");
    expect(second).toMatchObject({ ok: true, value: { display_name: "SOTF Transition — Daily Brief" } });
  });

  it("fails compatibility when any LE or required host capability is absent", () => {
    expect(evaluateSotfV1Capabilities(SOTF_V1_REQUIRED_CAPABILITIES)).toEqual({ compatible: true, missing_capabilities: [] });
    expect(evaluateSotfV1Capabilities(SOTF_V1_REQUIRED_CAPABILITIES.filter((value) => value !== "daily_brief")))
      .toEqual({ compatible: false, missing_capabilities: ["daily_brief"] });
    expect(evaluateSotfV1HostCapabilities(["mcp", "user_interaction", "reasoning", "approval_interaction"]))
      .toEqual({ compatible: true, missing_required: [], missing_optional: ["calendar_read", "email_read"] });
    expect(evaluateSotfV1HostCapabilities(["mcp", "reasoning"]).compatible).toBe(false);
  });
});
