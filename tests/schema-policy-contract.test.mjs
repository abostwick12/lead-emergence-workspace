import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile("supabase/migrations/20260820000000_workspace_foundation.sql", "utf8");
const configToml = await readFile("supabase/config.toml", "utf8");
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
