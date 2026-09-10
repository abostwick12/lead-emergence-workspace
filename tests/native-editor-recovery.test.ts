import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
import {editorKinds} from "@/vendor/lead-emergence-bundles/domain-contracts/editor-recovery";

const sql=readFileSync("supabase/migrations/20260915120000_native_editor_recovery.sql","utf8");
const route=readFileSync("app/api/bundles/editor-drafts/route.ts","utf8");
const hook=readFileSync("components/bundles/use-native-editor-draft.ts","utf8");
const recovery=readFileSync("components/bundles/editor-draft-recovery.tsx","utf8");
const editors=["ministry","nonprofit","investor","executive"].map(domain=>readFileSync("components/"+domain+"-bundle/editor.tsx","utf8"));

describe("native editor recovery host boundaries",()=>{
 it("covers every shipped native editor type",()=>{
 expect(Object.values(editorKinds).flat()).toHaveLength(16);
  for(const [domain,kinds] of Object.entries(editorKinds)){
   expect(sql).toContain('"'+domain+'":{');for(const kind of kinds)expect(sql).toContain('"'+kind+'":{');
  }
 });
 it("keeps drafts private, direct-session only and separate by domain",()=>{
  for(const domain of Object.keys(editorKinds)){
   expect(sql).toContain("create table workspace_private."+domain+"_editor_drafts");
   expect(sql).toContain("create table workspace_private."+domain+"_editor_draft_receipts");
  }
  expect(sql).toContain("workspace_private.is_direct_session()");expect(sql).toContain("auth.jwt()->>'client_id' is not null");
  expect(sql).toContain("pg_advisory_xact_lock");expect(sql).toContain("version<>expected_version");
  expect(sql).toContain("revoke all on function workspace.native_editor_draft(jsonb),workspace.native_change_editor_draft(jsonb) from public,anon");
 });
 it("bounds and authenticates the no-cache API without a privileged client",()=>{
  expect(route).toContain('"Cache-Control":"no-store, private"');expect(route).toContain("size>650000");
  expect(route).toContain("editorDraftChange.parse(raw)");expect(route).toContain("authenticatedBundleClient(readBearerToken(request))");
  expect(route).not.toContain("service_role");
 });
 it("uses server recovery, stable exact retries and explicit restore decisions",()=>{
  expect(hook).toContain('fetch(path,{method:input?"POST":"GET",cache:"no-store"');
  expect(hook).not.toContain("localStorage");expect(hook).not.toContain("sessionStorage");
  expect(hook).toContain("attempt.current.payload!==payload");expect(hook).toContain("expectedVersion:version.current");
  expect(hook).toContain("setTimeout(()=>{void flush();},800)");expect(hook).toContain("current===generation.current");
  expect(recovery).toContain("Restore unfinished work");expect(recovery).toContain("separate from the official record and has not been approved, sent or published");
  expect(recovery).toContain('role="alert"');expect(recovery).toContain('role="status"');
 });
 it("routes all four native editors through atomic draft commit",()=>{
  expect(hook).toContain("committing");
  for(const editor of editors){expect(editor).toContain("useNativeEditorDraft(");expect(editor).toContain("draft.commit()");expect(editor).toContain("<EditorDraftRecovery");expect(editor).toContain("draft.committing");expect(editor).not.toContain("draft.saving");}
 });
});
