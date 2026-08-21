import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  executionPackage,
  gateAMigrations,
  normalizeSql,
  packageMigration,
  sha256,
  validateSourceProvenance,
} from "./gate-a-package.mjs";

const execFileAsync = promisify(execFile);
const sourceCommit = process.argv[2]?.trim();
if (!/^[0-9a-f]{40}$/i.test(sourceCommit || "")) {
  throw new Error("Pass the full committed Workspace SHA: npm run verify:shared-migration -- <sha>.");
}

const { stdout: head } = await execFileAsync("git", ["rev-parse", "HEAD"]);
if (sourceCommit !== head.trim()) {
  throw new Error("Verify only the package generated from the current committed Workspace HEAD.");
}

const packagedMigrations = [];
for (const fileName of gateAMigrations) {
  const sourcePath = `supabase/migrations/${fileName}`;
  const { stdout } = await execFileAsync("git", ["show", `${sourceCommit}:${sourcePath}`], { maxBuffer: 1024 * 1024 });
  const sourceSql = normalizeSql(stdout);
  validateSourceProvenance(fileName, sourceSql);
  const expected = packageMigration({ sourceCommit, sourceSql });
  const packagePath = resolve("artifacts/shared-project", fileName);
  const actual = normalizeSql(await readFile(packagePath, "utf8"));
  if (actual !== expected.packagedSql) {
    throw new Error(`${fileName} is not byte-for-byte equivalent to the deterministic package output.`);
  }
  packagedMigrations.push({ fileName, ...expected });
}

const expectedExecution = executionPackage({ sourceCommit, packagedMigrations });
const executionPath = resolve("artifacts/shared-project/gate-a-execution.sql");
const actualExecution = normalizeSql(await readFile(executionPath, "utf8"));
if (actualExecution !== expectedExecution) {
  throw new Error("gate-a-execution.sql is not byte-for-byte equivalent to the deterministic package output.");
}

console.log(JSON.stringify({
  sourceCommit,
  migrations: packagedMigrations.map(({ fileName, sourceChecksum, packagedSql }) => ({
    fileName,
    sourceChecksum,
    packageChecksum: sha256(packagedSql),
  })),
  executionChecksum: sha256(actualExecution),
  verified: true,
}, null, 2));
