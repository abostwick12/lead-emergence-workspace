import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourceCommit = process.argv[2]?.trim() || "UNCOMMITTED";
const sourcePath = resolve("supabase/migrations/20260820000000_workspace_foundation.sql");
const sql = (await readFile(sourcePath, "utf8")).replaceAll("\r\n", "\n");
const checksum = createHash("sha256").update(sql).digest("hex");
const outputPath = resolve("artifacts/shared-project/20260820000000_workspace_foundation.sql");
const header = `-- DOMAIN OWNER: LEAD EMERGENCE WORKSPACE\n-- SOURCE REPOSITORY: abostwick12/lead-emergence-workspace\n-- SOURCE COMMIT: ${sourceCommit}\n-- SOURCE CHECKSUM: ${checksum}\n`;
await mkdir(resolve("artifacts/shared-project"), { recursive: true });
await writeFile(outputPath, `${header}\n${sql}`, "utf8");
console.log(JSON.stringify({ outputPath, checksum, sourceCommit }, null, 2));
