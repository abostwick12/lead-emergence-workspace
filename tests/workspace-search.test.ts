import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {composeBundleExperience} from "@/lib/bundles/experience";
import {nativeQuickActions} from "@/lib/bundles/quick-actions";
import {nativeSearchProviders,admittedSearchProviders} from "@/vendor/lead-emergence-bundles/domain-contracts/workspace-discovery";
const keys=["writer_editor","ministry","nonprofit_founder","investor","executive","workspace_experience"];
const caps=[...new Set(nativeSearchProviders.flatMap(p=>[...p.capabilityIds])),"workspace.compose","workspace.search","workspace.personalize"];
function experience(removed:string[]=[]){
 return composeBundleExperience({schemaVersion:"1.0",workspaceId:"11111111-1111-4111-8111-111111111111",subjectId:"22222222-2222-4222-8222-222222222222",revision:"current",resolvedAt:"2026-09-09T10:00:00Z",
 assignments:keys.map(bundleKey=>({bundleKey,status:"active",startsAt:"2026-01-01T00:00:00Z",expiresAt:null})),
 capabilities:caps.filter(c=>!removed.includes(c)).map(capabilityId=>({capabilityId,bundleKey:capabilityId.startsWith("writer.")?"writer_editor":capabilityId.startsWith("nonprofit.")?"nonprofit_founder":capabilityId.startsWith("workspace.")?"workspace_experience":capabilityId.split(".")[0]}))});
}
describe("native discovery composition",()=>{
 it("matches all SQL provider identities, domain kinds and required capabilities",()=>{
  const sql=readFileSync("supabase/migrations/20260912120000_workspace_saved_search.sql","utf8");
  for(const p of nativeSearchProviders)expect(sql).toContain("('"+p.id+"','"+p.bundleKey+"','"+p.kind+"',array["+p.capabilityIds.map(c=>"'"+c+"'").join(",")+"])");
 });
 it("provides ten genuine navigation actions across all six assigned bundles",()=>{
  const actions=nativeQuickActions(experience());expect(actions).toHaveLength(10);
  expect(new Set(actions.map(a=>a.bundleKey)).size).toBe(6);
  expect(actions.every(a=>a.route.startsWith("/workspace/"))).toBe(true);
  expect(actions.some(a=>a.label.includes("Recommend"))).toBe(false);
 });
 it("removes unavailable actions and requires both Writer capabilities",()=>{
  expect(nativeQuickActions(experience(["writer.resource.library"])).some(a=>a.bundleKey==="writer_editor")).toBe(false);
  expect(nativeQuickActions(experience(["executive.brief","workspace.personalize"])).some(a=>a.route.endsWith("/daily_brief/new")||a.route==="/workspace/layout")).toBe(false);
 });
 it("admits shared search only when the backend supplies the capability",()=>{
  expect(experience().ui.secondaryNavigation.some(i=>i.route==="/workspace/search")).toBe(true);
  expect(admittedSearchProviders(experience(["workspace.search"]).capabilityIds)).toEqual([]);
 });
 it("keeps original shortcut and does not navigate or expose query via URL",()=>{
  const shell=readFileSync("components/workspace-shell.tsx","utf8"),ui=readFileSync("components/bundles/workspace-search.tsx","utf8");
  expect(shell).toContain("!event.shiftKey");expect(shell).toContain("setCaptureOpen(true)");
  expect(ui).not.toMatch(/localStorage|sessionStorage|URLSearchParams|router\.push|dangerouslySetInnerHTML/);
  expect(ui).toContain("id!==generation.current");
 });
});
