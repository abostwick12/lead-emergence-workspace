import type { PlanCapabilityRecord } from "@/lib/workspace/types";

export const CAPABILITY_DEFINITIONS = {
  core_workspace: { label: "Core Workspace", benefit: "Keep leadership context, commitments, and decisions in one private system." },
  tasks: { label: "Daily Focus", benefit: "Turn commitments into a clear, editable daily focus." },
  quick_capture: { label: "Quick Capture", benefit: "Capture a signal before deciding what it means." },
  memory: { label: "Personal Memory", benefit: "Retain confirmed context that can improve future assistance." },
  career: { label: "Career Pipeline", benefit: "Track opportunities and their next useful action." },
  daily_brief: { label: "Daily Brief", benefit: "Configure a review of priorities, commitments, and change." },
  workspace_mcp: { label: "AI Assistant Connection", benefit: "Use ChatGPT or Claude as an authorized Workspace interface." },
  leader_mode: { label: "Leader Mode", benefit: "Add higher-level leadership synthesis when separately enabled." },
  external_connectors: { label: "External Connections", benefit: "Connect approved external systems with explicit consent." },
  advanced_mcp: { label: "Advanced AI Tools", benefit: "Use an expanded set of assistant tools and resources." },
  agentic_workflows: { label: "Agentic Workflows", benefit: "Run bounded multi-step assistant workflows." },
  advanced_automation: { label: "Advanced Automation", benefit: "Run approved automations while retaining their configuration." },
  integration_limit: { label: "Connection Limit", benefit: "The number of external systems that may be connected at once." }
} as const;

export type CapabilityKey = keyof typeof CAPABILITY_DEFINITIONS;
export type CapabilityResolution = Record<Exclude<CapabilityKey, "integration_limit">, boolean> & { integration_limit: number };

export const EMPTY_CAPABILITIES: CapabilityResolution = {
  core_workspace: false,
  tasks: false,
  quick_capture: false,
  memory: false,
  career: false,
  daily_brief: false,
  workspace_mcp: false,
  leader_mode: false,
  external_connectors: false,
  advanced_mcp: false,
  agentic_workflows: false,
  advanced_automation: false,
  integration_limit: 0
};

export function resolveCapabilities(rows: PlanCapabilityRecord[], leaderModeEntitled = false): CapabilityResolution {
  const resolved = { ...EMPTY_CAPABILITIES };
  for (const row of rows) {
    if (!(row.capability_key in CAPABILITY_DEFINITIONS)) continue;
    if (row.capability_key === "integration_limit") {
      resolved.integration_limit = row.enabled ? Math.max(0, row.limit_value ?? 0) : 0;
      continue;
    }
    resolved[row.capability_key as Exclude<CapabilityKey, "integration_limit">] = row.enabled;
  }
  if (leaderModeEntitled) resolved.leader_mode = true;
  return resolved;
}

export function capabilityIncluded(capabilities: CapabilityResolution, key: CapabilityKey) {
  return key === "integration_limit" ? capabilities.integration_limit > 0 : capabilities[key];
}

export function capabilityEnabled(capabilities: CapabilityResolution, key: CapabilityKey, planStatus: "active" | "suspended" | undefined) {
  return planStatus === "active" && capabilityIncluded(capabilities, key);
}
