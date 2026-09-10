import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
import {bundleConnectionGuidance} from "@/lib/bundles/experience";
const sql=readFileSync("supabase/migrations/20260913120000_workspace_connection_center.sql","utf8");
const lock=readFileSync("supabase/migrations/20260913123000_connection_consent_serialization.sql","utf8");
const ui=readFileSync("components/bundles/connection-center.tsx","utf8"),route=readFileSync("app/api/bundles/connections/route.ts","utf8");
describe("native connection host boundary",()=>{
 it("retains native privacy controls without a bundle or paid-plan gate",()=>{
  const guard=sql.slice(0,sql.indexOf("create function workspace_private.connection_center_rows"));
  expect(guard).toContain("not workspace_private.is_direct_session()");
  expect(guard).toContain("auth.jwt()->>'client_id' is not null");
  expect(guard).not.toMatch(/require_bundle_workspace|has_personal_capability/);
 });
 it("uses current authority instead of metadata-only connection labels",()=>{
  expect(sql).toContain("workspace_private.mcp_oauth_resource_grants");
  expect(sql).toContain("c.deleted_at is not null");expect(sql).toContain("v.token_expires_at<=now()");
  expect(sql).toContain("'authorizedTotal',(select count(*) from assistants where item->>'state'='authorized')");
 });
 it("serializes first consent and exact revocation and returns retries before a new mutation",()=>{
  expect(lock.match(/hashtextextended\('workspace-mcp-grant:'/g)).toHaveLength(2);
  expect(lock).toContain("return saved.result");
  expect(lock.indexOf("return saved.result")).toBeLessThan(lock.indexOf("delete from workspace_private.integration_credentials"));
  expect(lock).toContain("entry.revision is distinct from p_revision");
 });
 it("requires strict bounded HTTP input and private uncached output",()=>{
  expect(route).toContain("bytes>2000");expect(route).toContain("connectionReview.safeParse(raw)");
  expect(route).toContain('"Cache-Control":"no-store, private"');expect(route).not.toContain("service_role");
  expect(ui).toContain("consumerConnectionReady&&data.releasedProviders.includes(id)");
  expect(ui).toContain('requestId:crypto.randomUUID()');expect(ui).toContain("JSON.stringify(reviewed.input)");
 });
 it("composes bundle guidance without turning planned providers into connections",()=>{
  expect(bundleConnectionGuidance([])).toEqual([]);
  const writing=bundleConnectionGuidance(["writer_editor"]);
  expect(writing).toHaveLength(1);expect(writing[0].providers[0].provider).toBe("wix");
  expect(writing[0].apps[0].status).toBe("planned");
  expect(bundleConnectionGuidance(["investor"])[0].providers[0].authorization.required).toBe(false);
 });
});
