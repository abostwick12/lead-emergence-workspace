import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
import {notificationDefinitions,notificationSnapshot} from "@/vendor/lead-emergence-bundles/domain-contracts/workspace-notifications";
const sql=readFileSync("supabase/migrations/20260914120000_workspace_notifications.sql","utf8");
const route=readFileSync("app/api/bundles/notifications/route.ts","utf8"),ui=readFileSync("components/bundles/notification-center.tsx","utf8");
describe("native notification host boundaries",()=>{
 it("binds every portable type to actual database capability checks",()=>{
  for(const d of notificationDefinitions)expect(sql).toContain("('"+d.id+"','"+d.bundleKey+"','"+d.capabilityId+"')");
  expect(sql).toContain("workspace_private.require_connection_center_owner()");
  expect(sql).toContain("workspace_private.require_bundle_workspace()");
 });
 it("keeps personal choices private and serialized without mutating sources",()=>{
  expect(sql).toContain("pg_advisory_xact_lock(hashtextextended('workspace-notifications:'");
  expect(sql).toContain("current_version<>expected");expect(sql).toContain("saved.input is distinct from p_change");
  expect(sql).toContain("current_signals->>(r->>'id') is distinct from r->>'revision'");
  expect(sql).not.toMatch(/update workspace_private\.(writing_resources|ministry_documents|nonprofit_documents|investor_documents|executive_documents)/i);
 });
 it("bounds requests and does not cache sensitive snapshots",()=>{
  expect(route).toContain("bytes>12000");expect(route).toContain('"Cache-Control":"no-store, private"');
  expect(route).toContain("notificationChange.safeParse(raw)");expect(route).not.toContain("service_role");
 });
 it("supports exact retries, clears late responses and makes no delivery claim",()=>{
  expect(ui).toContain("JSON.stringify(change)");expect(ui).toContain("Retry same change");
  expect(ui).toContain('document.visibilityState==="hidden"');expect(ui).toContain("current===generation.current");
  expect(ui).toContain("No email, push, background monitoring or reminders are sent.");
 });
 it("rejects missing source or status metadata",()=>{
  const shell=readFileSync("components/workspace-shell.tsx","utf8");
  expect(shell).toContain('<main className="main">{children}</main>');
  expect(shell).toContain('className="workspace-header"');
  expect(notificationSnapshot.safeParse({workspaceId:"14111111-1111-4111-8111-111111111111",items:[]}).success).toBe(false);
 });
});
