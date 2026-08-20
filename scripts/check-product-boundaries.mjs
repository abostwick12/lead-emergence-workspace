import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const roots = ["app", "components", "lib"];
const forbidden = [/from\s+["'][^"']*(?:emergence-ministry|consulting-os|\/ministry\/|\/consulting\/)[^"']*["']/i, /SUPABASE_SERVICE_ROLE_KEY/, /getSupabaseAdminClient/];
const files = [];
async function collect(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const fullPath = join(path, entry.name);
    if (entry.isDirectory()) await collect(fullPath);
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) files.push(fullPath);
  }
}
for (const root of roots) await collect(root);
const violations = [];
for (const file of files) {
  const content = await readFile(file, "utf8");
  for (const expression of forbidden) if (expression.test(content)) violations.push(`${file}: ${expression}`);
}
if (violations.length) throw new Error(`Workspace product-boundary violations:\n${violations.join("\n")}`);
console.log(`Verified ${files.length} runtime files: no ministry/Consulting imports or service-role client.`);
