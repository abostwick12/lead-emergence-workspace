import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bundleValuePilotDefinitions } from "@/lib/bundles/experience";
import { assessValuePilot, valuePilotBundleKeys, valuePilotChange } from "@/vendor/lead-emergence-bundles/domain-contracts/value-pilot";

const migration = readFileSync("supabase/migrations/20260915130000_bundle_value_pilots.sql", "utf8");
const route = readFileSync("app/api/bundles/value-pilots/route.ts", "utf8");
const component = readFileSync("components/bundles/value-pilot.tsx", "utf8");

describe("bundle value pilot host", () => {
  it("derives all six promises from portable manifests and current capabilities", () => {
    const unavailable = bundleValuePilotDefinitions([]);
    expect(unavailable.map(item => item.bundleKey)).toEqual(valuePilotBundleKeys);
    expect(unavailable.every(item => !item.available)).toBe(true);
    expect(unavailable.every(item => item.successSignals.length === 2 && item.targetMinutes <= 12)).toBe(true);
    const current = bundleValuePilotDefinitions(["writer.resource.review", "workspace.compose", "investor.filings"]);
    expect(current.filter(item => item.available).map(item => item.bundleKey)).toEqual(["writer_editor", "investor", "workspace_experience"]);
    expect(current.find(item => item.bundleKey === "writer_editor")?.workspaceRoute).toBe("/workspace/writing");
  });
  it("keeps the measurement bounded, user-reported and distinct from elapsed time", () => {
    expect(valuePilotChange.safeParse({ operation: "start", requestId: crypto.randomUUID(), bundleKey: "executive", baselineMinutes: 25 }).success).toBe(true);
    expect(valuePilotChange.safeParse({ operation: "start", requestId: crypto.randomUUID(), bundleKey: "executive", baselineMinutes: 25, prompt: "private work" }).success).toBe(false);
    expect(assessValuePilot({ baselineMinutes: 25, targetMinutes: 8, elapsedSeconds: 421, outcomeAchieved: true,
      ratings: { usefulness: 5, trust: 4, actionability: 4 }, gates: { evidenceVisible: true, provenanceVisible: true, mutationControlPreserved: true },
      requiredGates: { evidenceRequired: true, provenanceRequired: true, mutationConfirmationRequired: true } })).toEqual({
        targetMet: true, qualityGatesMet: true, estimatedMinutesSaved: 17, assessment: "strong_signal"
      });
  });
  it("uses private server storage, direct native authority and exact retry receipts", () => {
    expect(migration).toContain("create table workspace_private.bundle_value_pilot_sessions");
    expect(migration).toContain("create table workspace_private.bundle_value_pilot_receipts");
    expect(migration).toContain("workspace_private.is_direct_session()");
    expect(migration).toContain("auth.jwt()->>'client_id' is not null");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("prior.input_hash<>fingerprint");
    expect(migration).toContain("baseline_minutes");
    expect(migration).toContain("extract(epoch from now_at-current.started_at)");
    expect(migration).not.toMatch(/\b(prompt_text|source_excerpt|output_text|client_content)\b/);
  });
  it("bounds the authenticated API and never uses a privileged browser or server client", () => {
    expect(route).toContain("size > 40_000");
    expect(route).toContain("authenticatedBundleClient(readBearerToken(request))");
    expect(route).toContain('"Cache-Control": "no-store, private"');
    expect(route).not.toContain("service_role");
    expect(component).toContain("The baseline was recorded before work began");
    expect(component).toContain("attempt.current?.payload === payload");
    expect(component).not.toContain("localStorage");
    expect(component).not.toContain("sessionStorage");
  });
});
