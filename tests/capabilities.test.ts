import { describe, expect, it } from "vitest";
import { capabilityEnabled, capabilityIncluded, EMPTY_CAPABILITIES, resolveCapabilities } from "@/lib/workspace/capabilities";

describe("Personal capability resolver", () => {
  it("defaults every capability to unavailable", () => {
    expect(EMPTY_CAPABILITIES.core_workspace).toBe(false);
    expect(EMPTY_CAPABILITIES.workspace_mcp).toBe(false);
    expect(EMPTY_CAPABILITIES.integration_limit).toBe(0);
  });

  it("resolves boolean and bounded integer capabilities without plan-name checks", () => {
    const capabilities = resolveCapabilities([
      { capability_key: "core_workspace", enabled: true, limit_value: null },
      { capability_key: "workspace_mcp", enabled: true, limit_value: null },
      { capability_key: "integration_limit", enabled: true, limit_value: 3 },
      { capability_key: "advanced_automation", enabled: false, limit_value: null }
    ]);

    expect(capabilities.core_workspace).toBe(true);
    expect(capabilities.workspace_mcp).toBe(true);
    expect(capabilities.advanced_automation).toBe(false);
    expect(capabilities.integration_limit).toBe(3);
    expect(capabilityIncluded(capabilities, "integration_limit")).toBe(true);
  });

  it("honors the separately assigned Leader Mode entitlement", () => {
    expect(resolveCapabilities([], true).leader_mode).toBe(true);
  });

  it("requires both plan inclusion and an active plan for capability use", () => {
    const included = resolveCapabilities([{ capability_key: "tasks", enabled: true, limit_value: null }]);
    expect(capabilityEnabled(included, "tasks", "active")).toBe(true);
    expect(capabilityEnabled(included, "tasks", "suspended")).toBe(false);
    expect(capabilityEnabled(EMPTY_CAPABILITIES, "tasks", "active")).toBe(false);
  });
});
