import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { localConfiguration, localSql } from "./bundle-local-runtime.mjs";
// Explicit local suites only. Hosted shared-project preflight is not applicable.
await localConfiguration();
localSql("create extension if not exists pgtap with schema extensions;");
const suites = ["hostile_workspace_access", "workspace_clock_preferences", "workspace_productization", "workspace_product_events", "lewis_workspace_parity", "lewis_connector_capability_gates", "lewis_workspace_preference_parity", "bundle_entitlement_foundation", "sotf_operational_workflows", "writer_bundle_experience", "ministry_native_workspace", "nonprofit_native_workspace", "investor_native_workspace", "executive_native_workspace", "executive_attention", "executive_task_attention", "executive_weekly_outcomes", "executive_availability_planning", "workspace_layout_preferences", "workspace_saved_search", "workspace_native_attention", "workspace_connection_center", "workspace_notifications", "native_editor_recovery", "bundle_value_pilots", "cross_domain_isolation_matrix", "source_intake_authorization"];
let total = 0;
for (const name of suites) {
  const output = localSql("set search_path=workspace,extensions,public;\n" + await readFile("supabase/tests/database/" + name + ".sql", "utf8"));
  assert.doesNotMatch(output, /^not ok|# (?:Failed|SKIP|TODO)/m, name + " failed: " + output);
  const plan = output.match(/^1\.\.(\d+)$/m); assert.ok(plan, name + " missing assertion plan.");
  const passed = [...output.matchAll(/^ok \d+\b/gm)].length;
  assert.equal(passed, Number(plan[1]), name + " did not execute every planned assertion."); total += passed;
  console.log("PASS " + name + ": " + passed + " PostgreSQL assertions.");
}
console.log("Local PostgreSQL acceptance: " + total + " assertions across " + suites.length + " suites. Each suite rolls back its fixtures.");
