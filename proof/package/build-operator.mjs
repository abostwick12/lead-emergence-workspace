import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = 'source/20261009180000_entry_dev_preview_mcp_resource_review.sql';
const expectedSourceSha = '6cd9a21389f0b6a3a40416aa0ad02443ab354cca9c506be5b186957c113ad0d3';
const source = fs.readFileSync(path.join(root, sourcePath));
const digest = crypto.createHash('sha256').update(source).digest('hex');
if (digest !== expectedSourceSha) throw new Error('Workspace source bytes changed; stop.');

// pg_proc.prosrc includes the exact bytes between AS $$ and $$.
const expectedBodies = new Map([
  ['workspace_private.resolve_mcp_oauth_authorization', '2560fcbd6b62f7bbb3f1d4f6ba056d05'],
  ['workspace.activate_mcp_oauth_grant', '336eb07ee437451628318e4c7d588c28'],
  ['workspace_private.revoke_mcp_oauth_resource_grant', 'ab24339bf27b36e9e402060753e6ad58'],
  ['workspace_private.is_valid_mcp_request', '3c4354dc94694d65fa5f0c88ce748adf'],
  ['workspace_private.custom_access_token_hook', '06ccbc035737207b1fc80a6969a37e8f'],
]);
for (const [name, expected] of expectedBodies) {
  const expression = new RegExp('create or replace function ' + name.replaceAll('.', '\\.') + '\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;', 'g');
  const matches = [...source.toString('utf8').matchAll(expression)];
  if (matches.length !== 1 || crypto.createHash('md5').update(matches[0][1]).digest('hex') !== expected) {
    throw new Error('Function source digest mismatch: ' + name);
  }
}

function guarded(file, name) {
  const query = fs.readFileSync(path.join(root, file), 'utf8').trimEnd();
  const suffix = new RegExp('as gate_' + name + ';$');
  if (!suffix.test(query)) throw new Error('Guard query no longer returns gate_' + name);
  return [
    'DO $' + name + '$',
    'DECLARE gate jsonb;',
    'BEGIN',
    query.replace(suffix, 'into gate;'),
    "IF coalesce((gate->>'ready')::boolean, false) IS DISTINCT FROM true THEN",
    "  RAISE EXCEPTION 'Entry-dev " + name + " guard failed; transaction aborted.';",
    'END IF;',
    'END;',
    '$' + name + '$;',
  ].join('\n');
}

const operator = [
  '-- GENERATED REVIEW PACKET. Regenerate with node build-operator.mjs; do not edit by hand.',
  '-- Target: nonproduction Entry-dev / vnjdubrnmxvmsccxmhst.',
  '-- Workspace PR #61 exact source head: 3fca013398851671446d713aebb684b48b79eb29.',
  '-- Source SHA-256: ' + expectedSourceSha,
  '-- Separate exact-action approval required. No Preview URI is configured by this package.',
  'BEGIN;',
  "SET LOCAL lock_timeout = '2s';",
  "SET LOCAL statement_timeout = '30s';",
  guarded('preflight.sql', 'preflight'),
  source.toString('utf8'),
  "INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('20261009180000','entry_dev_preview_mcp_resource_review');",
  guarded('postflight.sql', 'postflight'),
  'COMMIT;',
  '',
].join('\n');
fs.writeFileSync(path.join(root, 'operator-apply.sql'), operator, 'utf8');
console.log('Generated pinned operator-apply.sql from the unchanged Workspace source.');
