import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourcePath = resolve("supabase/migrations/20260820000000_workspace_foundation.sql");
const packagePath = resolve(process.argv[2] || "artifacts/shared-project/20260820000000_workspace_foundation.sql");
const source = (await readFile(sourcePath, "utf8")).replaceAll("\r\n", "\n");
const packaged = (await readFile(packagePath, "utf8")).replaceAll("\r\n", "\n");
const checksum = createHash("sha256").update(source).digest("hex");
if (!packaged.includes(`SOURCE CHECKSUM: ${checksum}`) || !packaged.endsWith(source)) throw new Error("Shared-project package does not exactly contain the Workspace migration source.");
console.log(`Verified shared-project migration checksum ${checksum}.`);
