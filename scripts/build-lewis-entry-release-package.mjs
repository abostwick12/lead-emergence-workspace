import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
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
  throw new Error("Pass the full committed Workspace SHA: npm run build:lewis-entry-release -- <sha>.");
}

const { stdout: head } = await execFileAsync("git", ["rev-parse", "HEAD"]);
if (sourceCommit !== head.trim()) {
  throw new Error("The Lewis Entry release package must be generated from the current committed Workspace HEAD.");
}

const outputDirectory = resolve("artifacts/lewis-entry-release");
await mkdir(outputDirectory, { recursive: true });

const packagedMigrations = [];
for (const fileName of lewisEntryReleaseMigrations) {
  const sourcePath = `supabase/migrations/${fileName}`;
  const { stdout } = await execFileAsync("git", ["show", `${sourceCommit}:${sourcePath}`], { maxBuffer: 1024 * 1024 });
  const sourceSql = normalizeSql(stdout);
  validateSourceProvenance(fileName, sourceSql);
  const { sourceChecksum, packagedSql } = packageMigration({ sourceCommit, sourceSql });
  const outputPath = resolve(outputDirectory, fileName);
  await writeFile(outputPath, packagedSql, "utf8");
  packagedMigrations.push({ fileName, sourceChecksum, packagedSql, outputPath });
}

const preflight = entryPreflightSql();
const preflightPath = resolve(outputDirectory, "lewis-entry-preflight.sql");
await writeFile(preflightPath, preflight, "utf8");

const executionSql = executionPackage({ sourceCommit, packagedMigrations });
const executionPath = resolve(outputDirectory, "lewis-entry-execution.sql");
await writeFile(executionPath, executionSql, "utf8");

console.log(JSON.stringify({
  sourceCommit,
  migrations: packagedMigrations.map(({ fileName, sourceChecksum, packagedSql, outputPath }) => ({
    fileName,
    sourceChecksum,
    packageChecksum: sha256(packagedSql),
    outputPath,
  })),
  preflightPath,
  preflightChecksum: sha256(preflight),
  executionPath,
  executionChecksum: sha256(executionSql),
}, null, 2));
