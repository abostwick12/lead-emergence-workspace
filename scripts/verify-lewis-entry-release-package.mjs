import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import {
  entryPreflightSql,
  executionPackage,
  lewisEntryReleaseMigrations,
  normalizeSql,
  packageMigration,
  sha256,
  validateSourceProvenance,
} from "./lewis-entry-release-package.mjs";

const execFileAsync = promisify(execFile);
const sourceCommit = process.argv[2]?.trim();
if (!/^[0-9a-f]{40}$/i.test(sourceCommit || "")) {
  throw new Error("Pass the full committed Workspace SHA: npm run verify:lewis-entry-release -- <sha>.");
}

const { stdout: head } = await execFileAsync("git", ["rev-parse", "HEAD"]);
if (sourceCommit !== head.trim()) {
  throw new Error("Verify only the package generated from the current committed Workspace HEAD.");
}

const packagedMigrations = [];
for (const fileName of lewisEntryReleaseMigrations) {
  const sourcePath = `supabase/migrations/${fileName}`;
  const { stdout } = await execFileAsync("git", ["show", `${sourceCommit}:${sourcePath}`], { maxBuffer: 1024 * 1024 });
  const sourceSql = normalizeSql(stdout);
  validateSourceProvenance(fileName, sourceSql);
  const expected = packageMigration({ sourceCommit, sourceSql });
  const packagePath = resolve("artifacts/lewis-entry-release", fileName);
  const actual = normalizeSql(await readFile(packagePath, "utf8"));
  if (actual !== expected.packagedSql) {
    throw new Error(`${fileName} is not byte-for-byte equivalent to the deterministic package output.`);
  }
  packagedMigrations.push({ fileName, ...expected });
}

const expectedPreflight = entryPreflightSql();
const actualPreflight = normalizeSql(await readFile(resolve("artifacts/lewis-entry-release/lewis-entry-preflight.sql"), "utf8"));
if (actualPreflight !== expectedPreflight) {
  throw new Error("lewis-entry-preflight.sql is not byte-for-byte equivalent to the deterministic package output.");
}

const expectedExecution = executionPackage({ sourceCommit, packagedMigrations });
const actualExecution = normalizeSql(await readFile(resolve("artifacts/lewis-entry-release/lewis-entry-execution.sql"), "utf8"));
if (actualExecution !== expectedExecution) {
  throw new Error("lewis-entry-execution.sql is not byte-for-byte equivalent to the deterministic package output.");
}

console.log(JSON.stringify({
  sourceCommit,
  migrations: packagedMigrations.map(({ fileName, sourceChecksum, packagedSql }) => ({
    fileName,
    sourceChecksum,
    packageChecksum: sha256(packagedSql),
  })),
  preflightChecksum: sha256(actualPreflight),
  executionChecksum: sha256(actualExecution),
  verified: true,
}, null, 2));
