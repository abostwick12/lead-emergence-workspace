import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile("supabase/migrations/20260820000000_workspace_foundation.sql", "utf8");
const clockPreferencesSql = await readFile("supabase/migrations/20260821172607_workspace_clock_preferences.sql", "utf8");
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
const tenantTables = ["projects", "tasks", "notes", "meetings", "decisions", "commitments", "files", "capture_inbox", "job_applications", "memory_entries", "ai_conversations", "daily_briefings", "knowledge_sources", "knowledge_items", "weekly_feeds", "weekly_feed_items"];

test("uses dedicated exposed and private schemas", () => {
  assert.match(sql, /create schema if not exists workspace;/);
  assert.match(sql, /create schema if not exists workspace_private;/);
  assert.match(sql, /revoke all on schema workspace_private from public, anon, authenticated;/);
  assert.match(configToml, /schemas = \["workspace"\]/);
  assert.doesNotMatch(configToml, /workspace_private/);
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

test("resolves an existing active owner membership without provisioning Workspace data", () => {
  assert.match(workspaceResolver, /from\("workspace_memberships"\)/);
  assert.match(workspaceResolver, /\.eq\("role", "owner"\)/);
  assert.match(workspaceResolver, /\.eq\("status", "active"\)/);
  assert.doesNotMatch(workspaceResolver, /\.insert\(/);
  assert.doesNotMatch(workspaceResolver, /\.upsert\(/);
});

test("keeps the Gate C application private, non-indexed, and upload-disabled", () => {
  assert.doesNotMatch(loginPage, /signUp\s*\(/);
  assert.match(loginPage, /active Workspace membership/);
  assert.match(envExample, /NEXT_PUBLIC_WORKSPACE_UPLOADS_ENABLED=false/);
  assert.match(nextConfig, /X-Robots-Tag/);
  assert.match(robots, /disallow:\s*"\//);
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
