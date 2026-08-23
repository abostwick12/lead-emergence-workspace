import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile("supabase/migrations/20260820000000_workspace_foundation.sql", "utf8");
const productizationSql = await readFile("supabase/migrations/20260822044610_workspace_productization.sql", "utf8");
const clockPreferencesSql = await readFile("supabase/migrations/20260821172607_workspace_clock_preferences.sql", "utf8");
const firstCaptureEventSql = await readFile("supabase/migrations/20260822124500_workspace_first_capture_event.sql", "utf8");
const privateRlsSql = await readFile("supabase/migrations/20260822132000_workspace_private_rls.sql", "utf8");
const advisorPerformanceSql = await readFile("supabase/migrations/20260822133500_workspace_advisor_performance.sql", "utf8");
const configToml = await readFile("supabase/config.toml", "utf8");
const workspaceResolver = await readFile("lib/workspace/provision.ts", "utf8");
const workspaceProvider = await readFile("components/workspace-provider.tsx", "utf8");
const workspaceShell = await readFile("components/workspace-shell.tsx", "utf8");
const loginPage = await readFile("app/login/page.tsx", "utf8");
const envExample = await readFile(".env.example", "utf8");
const nextConfig = await readFile("next.config.mjs", "utf8");
const robots = await readFile("app/robots.ts", "utf8");
const globalCss = await readFile("app/globals.css", "utf8");
const workspaceRepository = await readFile("lib/workspace/repository.ts", "utf8");
const workspaceClocks = await readFile("components/workspace-clocks.tsx", "utf8");
const clockSettings = await readFile("components/clock-settings.tsx", "utf8");
const setupPage = await readFile("components/workspace-setup.tsx", "utf8");
const mcpRoute = await readFile("app/api/mcp/route.ts", "utf8");
const tenantTables = ["projects", "tasks", "notes", "meetings", "decisions", "commitments", "files", "capture_inbox", "job_applications", "memory_entries", "ai_conversations", "daily_briefings", "knowledge_sources", "knowledge_items", "weekly_feeds", "weekly_feed_items"];

test("uses dedicated exposed and private schemas", () => {
  assert.match(sql, /create schema if not exists workspace;/);
  assert.match(sql, /create schema if not exists workspace_private;/);
  assert.match(sql, /revoke all on schema workspace_private from public, anon, authenticated;/);
  assert.match(configToml, /schemas = \["workspace"\]/);
  assert.doesNotMatch(configToml, /schemas\s*=\s*\[[^\]]*workspace_private/);
  assert.match(configToml, /pg-functions:\/\/postgres\/workspace_private\/custom_access_token_hook/);
  for (const table of ["product_settings", "trusted_identity_providers", "plan_assignment_audit"]) {
    assert.match(privateRlsSql, new RegExp(`alter table workspace_private\\.${table} enable row level security`));
  }
  assert.doesNotMatch(privateRlsSql, /create policy/i);
});

test("does not reuse the insecure source email gate or service role", () => {
  assert.doesNotMatch(sql, /auth\.email\s*\(/i);
  assert.doesNotMatch(sql, /SUPABASE_SERVICE_ROLE_KEY/i);
  assert.match(sql, /workspace_private\.is_active_member/);
});

test("every tenant record table receives select and write policy coverage", () => {
  for (const table of tenantTables) assert.match(sql, new RegExp(`'${table}'`), `${table} missing from tenant policy loop`);
  assert.match(sql, /with check \(workspace_private\.is_workspace_owner\(workspace_id\) and created_by = auth\.uid\(\)\)/);
});

test("creates a private workspace bucket with owner-only mutations", () => {
  assert.match(sql, /values \('workspace-private', 'workspace-private', false\)/);
  assert.match(sql, /workspace_private_objects_insert/);
  assert.match(sql, /owner_id = auth\.uid\(\)::text/);
});

test("provisions Personal product state only through the trusted Entry identity RPC", () => {
  assert.match(workspaceResolver, /rpc\("ensure_personal_workspace"\)/);
  assert.doesNotMatch(workspaceResolver, /\.insert\(/);
  assert.doesNotMatch(workspaceResolver, /\.upsert\(/);
  assert.match(productizationSql, /join workspace_private\.trusted_identity_providers/);
  assert.match(productizationSql, /if provider_count <> 1 then/);
  assert.match(productizationSql, /already linked to a different Lead Emergence identity/);
  assert.match(productizationSql, /canonical_user_id = coalesce\(excluded\.canonical_user_id/);
  assert.match(productizationSql, /Personal Workspace authorization is not active/);
  assert.doesNotMatch(productizationSql, /on conflict \(workspace_id, user_id\) do update set status = 'active'/);
  assert.match(productizationSql, /insert into workspace\.personal_plans/);
  assert.match(productizationSql, /insert into workspace\.personal_onboarding/);
});

test("keeps the Gate C application private, non-indexed, and upload-disabled", () => {
  assert.doesNotMatch(loginPage, /signUp\s*\(/);
  assert.match(loginPage, /active Personal entitlement/);
  assert.match(loginPage, /Continue with Lead Emergence/);
  assert.match(envExample, /NEXT_PUBLIC_WORKSPACE_UPLOADS_ENABLED=false/);
  assert.match(nextConfig, /X-Robots-Tag/);
  assert.match(robots, /disallow:\s*"\//);
});

test("uses one shared resumable configuration model for AI and native setup", () => {
  assert.match(productizationSql, /create table if not exists workspace\.personal_configuration_items/);
  assert.match(productizationSql, /'user_reported', 'ai_suggested', 'user_confirmed', 'validated_configuration'/);
  assert.match(setupPage, /Connect ChatGPT/);
  assert.match(setupPage, /Connect Claude/);
  assert.match(setupPage, /Set up without AI/);
  assert.match(setupPage, /saveNativeConfiguration/);
  assert.match(setupPage, /Continue setup without AI/);
});

test("binds MCP OAuth tokens to the canonical resource and denies ordinary RLS traversal", () => {
  assert.match(configToml, /\[auth\.oauth_server\]/);
  assert.match(configToml, /allow_dynamic_registration = true/);
  assert.match(productizationSql, /claims := pg_catalog\.jsonb_set\(claims, '\{aud\}'/);
  assert.match(productizationSql, /claims := pg_catalog\.jsonb_set\(claims, '\{workspace_mcp\}'/);
  assert.match(productizationSql, /nullif\(auth\.jwt\(\) ->> 'client_id', ''\) is null/);
  assert.match(productizationSql, /workspace_private\.require_mcp_workspace\(\)/);
  assert.match(productizationSql, /workspace_private\.has_personal_capability\(target_workspace_id, 'workspace_mcp'\)/);
  assert.match(mcpRoute, /WWW-Authenticate/);
  assert.match(mcpRoute, /WebStandardStreamableHTTPServerTransport/);
});

test("keeps plans separate from record authorization and prepares trials without billing", () => {
  assert.match(productizationSql, /create table if not exists workspace\.personal_plans/);
  assert.match(productizationSql, /commercial_status text not null default 'unpriced'/);
  assert.match(productizationSql, /trial_started_at timestamptz/);
  assert.match(productizationSql, /personal_plan\.user_id = auth\.uid\(\)/);
  assert.match(productizationSql, /workspace_private\.is_workspace_owner\(workspace_id\)/);
  assert.match(productizationSql, /workspace_private\.has_personal_capability\(workspace_id, %L\)/);
  assert.match(productizationSql, /revoke insert, update, delete on workspace\.integration_connections from authenticated/);
  assert.match(productizationSql, /has_personal_capability\(\(\(storage\.foldername\(name\)\)\[1\]\)::uuid, 'core_workspace'\)/);
  assert.doesNotMatch(productizationSql, /stripe|subscription|price_id/i);
});

test("signs out the current browser session before returning to login", () => {
  assert.match(workspaceProvider, /auth\.signOut\(\{ scope: "local" \}\)/);
  assert.match(workspaceProvider, /if \(signOutError\) throw signOutError;/);
  assert.match(workspaceShell, /await signOut\(\);\s*window\.location\.replace\("\/login"\);/);
  assert.match(workspaceShell, /disabled=\{signingOut\}/);
  assert.match(globalCss, /\.sidebar \{[^}]*position: sticky;[^}]*height: 100vh;[^}]*overflow-y: auto;/);
});

test("preserves only an allowlisted Workspace pathname across login", () => {
  assert.match(workspaceShell, /workspaceLoginHref\(pathname\)/);
  assert.match(loginPage, /normalizeWorkspaceReturnPath\(next\)/);
  assert.match(workspaceShell, /window\.location\.replace\("\/login"\)/);
});

test("persists three display clocks without changing the primary Workspace timezone", () => {
  assert.match(clockPreferencesSql, /add column if not exists clock_timezones text\[\] not null/);
  assert.match(clockPreferencesSql, /cardinality\(clock_timezones\) = 3/);
  assert.match(clockPreferencesSql, /America\/New_York.+America\/Chicago.+America\/Los_Angeles/s);
  assert.match(workspaceRepository, /update\(\{ clock_timezones: clockTimeZones \}\)/);
  assert.doesNotMatch(workspaceRepository, /update\(\{[^}]*timezone:/s);
});

test("renders DST-aware local clocks with a responsive configuration surface", () => {
  assert.match(workspaceClocks, /formatWorkspaceClock\(now, timeZone\)/);
  assert.match(workspaceClocks, /useCurrentTime\(1_000\)/);
  assert.match(workspaceClocks, /clock-abbreviation/);
  assert.match(clockSettings, /IANA time zones/);
  assert.doesNotMatch(workspaceClocks, /fetch\(|axios|timeapi|worldtime/i);
  assert.match(globalCss, /\.workspace-clocks \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(globalCss, /@media \(max-width: 640px\)[^}]*\.workspace-header/s);
});

test("records first capture activation without copying Personal content", () => {
  assert.match(firstCaptureEventSql, /product_events_first_capture_unique/);
  assert.match(firstCaptureEventSql, /where event_name = 'first_capture_created'/);
  assert.match(firstCaptureEventSql, /security definer/);
  assert.match(firstCaptureEventSql, /set search_path = ''/);
  assert.match(firstCaptureEventSql, /on conflict do nothing/);
  assert.doesNotMatch(firstCaptureEventSql, /new\.raw_text|raw_text/);
});

test("hardens advisor-reported Workspace query paths without dropping useful indexes", () => {
  assert.match(advisorPerformanceSql, /position\('auth\.uid\(\)'/);
  assert.match(advisorPerformanceSql, /'\(select auth\.uid\(\)\)'/);
  assert.match(advisorPerformanceSql, /namespace\.nspname in \('workspace', 'workspace_private'\)/);
  assert.match(advisorPerformanceSql, /create index if not exists/);
  assert.doesNotMatch(advisorPerformanceSql, /drop index/i);
});
