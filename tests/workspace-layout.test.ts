import {describe,it,expect} from "vitest";
import {personalizeBundleExperience,layoutRecordSchema,layoutSaveSchema} from "@/lib/bundles/layout";
import {composeBundleExperience} from "@/lib/bundles/experience";
import {emptyWorkspaceLayout} from "@/vendor/lead-emergence-bundles/domain-contracts/workspace-layout";
import {workspaceSignInDestination} from "@/lib/workspace/return-path";
const workspaceId="11111111-1111-4111-8111-111111111111",subjectId="22222222-2222-4222-8222-222222222222";
const authority={schemaVersion:"1.0",workspaceId,subjectId,revision:"authority-A",resolvedAt:"2026-09-09T10:00:00Z",
 assignments:["writer_editor","workspace_experience"].map(bundleKey=>({bundleKey,status:"active",startsAt:"2026-01-01T00:00:00Z",expiresAt:null})),
 capabilities:[{bundleKey:"writer_editor",capabilityId:"writer.resource.library"},{bundleKey:"workspace_experience",capabilityId:"workspace.compose"},{bundleKey:"workspace_experience",capabilityId:"workspace.personalize"}]};
const base=composeBundleExperience(authority),record={workspaceId,revision:1,authorityRevision:base.revision,preferences:emptyWorkspaceLayout(),updatedAt:null,history:[]};
describe("native workspace layout isolation",()=>{
 it("admits Workspace Experience without enabling its unimplemented features",()=>{
  expect(base.bundleKeys).toContain("workspace_experience");expect(base.capabilityIds).not.toContain("workspace.search");
  expect(base.ui.secondaryNavigation.map(x=>x.route)).toContain("/workspace/layout");
  expect(base.ui.secondaryNavigation.map(x=>x.route)).not.toContain("/workspace/search");
 });
 it("keeps editor authority unchanged on preference saves",()=>{
  const changed=personalizeBundleExperience(base,{...record,preferences:{...record.preferences,hiddenItemIds:["writer_editor:writer.nav.writing"],defaultWorkspaceRoute:"/workspace/writing"}});
  expect(changed.revision).toBe(base.revision);expect(changed.capabilityIds).toEqual(base.capabilityIds);
  expect(changed.ui.primaryNavigation.some(x=>x.sourceBundleKey==="writer_editor")).toBe(false);
  expect(changed.ui.defaultWorkspaceRoute).toBe("/workspace/writing");
 });
 it.each([null,{...record,workspaceId:subjectId},{...record,authorityRevision:"changed"},{...record,revision:-1}])("keeps access intact while withholding an unverified layout",raw=>{
  const result=personalizeBundleExperience(base,raw);expect(result.layout?.status).toBe("unavailable");
  expect(result.capabilityIds).toEqual(base.capabilityIds);expect(result.revision).toBe(base.revision);expect(result.ui.primaryNavigation).toEqual([]);
 });
 it("does not admit a default workspace solely because the preference says so",()=>{
  const result=personalizeBundleExperience(base,{...record,preferences:{...record.preferences,defaultWorkspaceRoute:"/workspace/ministry"}});
  expect(result.ui.defaultWorkspaceRoute).toBe("/workspace");expect(result.layout?.defaultUnavailable).toBe(true);
 });
 it("rejects identity injection and unconfirmed writes before persistence",()=>{
  expect(layoutRecordSchema.safeParse({...record,subjectId}).success).toBe(false);
  expect(layoutSaveSchema.safeParse({preferences:record.preferences,expectedRevision:1,expectedAuthorityRevision:"a",requestId:workspaceId,confirmed:false}).success).toBe(false);
 });
 it("uses the preference only for a missing sign-in destination",()=>{
  expect(workspaceSignInDestination(null)).toBe("/workspace/start");expect(workspaceSignInDestination("")).toBe("/workspace/start");
  expect(workspaceSignInDestination("/workspace")).toBe("/workspace");expect(workspaceSignInDestination("/workspace/tasks?private=1")).toBe("/workspace/tasks");
  expect(workspaceSignInDestination("https://untrusted.invalid")).toBe("/workspace");
 });
});
