import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
import {composeBundleExperience} from "@/lib/bundles/experience";
import {personalizeBundleExperience} from "@/lib/bundles/layout";
import {emptyWorkspaceLayout} from "@/vendor/lead-emergence-bundles/domain-contracts/workspace-layout";
const sql=readFileSync("supabase/migrations/20260912160000_workspace_native_attention.sql","utf8");
describe("native attention host boundary",()=>{
 it("separates native attention from Executive/model permission paths",()=>{
  expect(sql).toContain("not workspace_private.is_direct_session()");
  expect(sql).toContain("auth.jwt()->>'client_id' is not null");
  expect(sql).toContain("bundle_capability_active(target,'workspace_experience','workspace.attention')");
  expect(sql).not.toMatch(/executive_source_allowed|executive_task_allowed|require_executive_any|update workspace_private.executive_source_permissions/);
 });
 it("projects named metadata only and repeats owner scope on each source",()=>{
  expect(sql).not.toMatch(/body_text|abstract|search_document_text|teachingOutline|return query select \*/);
  expect(sql.match(/x.workspace_id=target/g)?.length).toBe(9);
  expect(sql).toContain("limit 25 offset p_offset");
 });
 it("keeps complete counts and filters independent of page materialization",()=>{
  expect(sql).toContain("'total',(select count(*) from filtered)");
  expect(sql).toContain("'overallTotal',(select count(*) from signals)");
  expect(sql).toContain("p_offset not between 0 and 2147483000");
 });
 it("uses only active capabilities to compose and personalize the real widget",()=>{
  const workspaceId="11111111-1111-4111-8111-111111111111";
  const base=composeBundleExperience({schemaVersion:"1.0",workspaceId,subjectId:workspaceId,revision:"r",resolvedAt:"2026-09-09T12:00:00Z",
   assignments:[{bundleKey:"workspace_experience",status:"active",startsAt:"2026-01-01T00:00:00Z",expiresAt:null}],
   capabilities:["workspace.compose","workspace.attention","workspace.personalize"].map(capabilityId=>({bundleKey:"workspace_experience",capabilityId}))});
  expect(base.ui.dashboardWidgets.map(w=>w.id)).toContain("workspace.widget.attention");
  const hidden=personalizeBundleExperience(base,{workspaceId,revision:1,authorityRevision:"r",preferences:{...emptyWorkspaceLayout(),hiddenItemIds:["workspace_experience:workspace.widget.attention"]},updatedAt:null,history:[]});
  expect(hidden.ui.dashboardWidgets).toEqual([]);expect(hidden.capabilityIds).toEqual(base.capabilityIds);
 });
});
