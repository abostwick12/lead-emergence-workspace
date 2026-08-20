import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const migrationPath = resolve("supabase/migrations/20260820000000_workspace_foundation.sql");
const sql = await readFile(migrationPath, "utf8");
const required = ["create schema if not exists workspace", "create schema if not exists workspace_private", "enable row level security", "workspace-private", "workspace_private.is_active_member", "with check"];
for (const fragment of required) {
  if (!sql.includes(fragment)) throw new Error(`Workspace migration is missing required fragment: ${fragment}`);
}
if (/auth\.email\s*\(/i.test(sql)) throw new Error("Workspace migration must not authorize by email.");
if (/supabase_service_role|service_role_key/i.test(sql)) throw new Error("Workspace migration must not reference a runtime service role.");
const checksum = createHash("sha256").update(sql.replaceAll("\r\n", "\n")).digest("hex");
console.log(`${checksum}  supabase/migrations/20260820000000_workspace_foundation.sql`);
