import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
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
  throw new Error("Pass the full committed Workspace SHA: npm run build:shared-migration -- <sha>.");
}

const { stdout: head } = await execFileAsync("git", ["rev-parse", "HEAD"]);
if (sourceCommit !== head.trim()) {
  throw new Error("The shared package must be generated from the current committed Workspace HEAD.");
}

const outputDirectory = resolve("artifacts/shared-project");
await mkdir(outputDirectory, { recursive: true });

const packagedMigrations = [];
for (const fileName of gateAMigrations) {
  const sourcePath = `supabase/migrations/${fileName}`;
  const { stdout } = await execFileAsync("git", ["show", `${sourceCommit}:${sourcePath}`], { maxBuffer: 1024 * 1024 });
  const sourceSql = normalizeSql(stdout);
  validateSourceProvenance(fileName, sourceSql);
  const { sourceChecksum, packagedSql } = packageMigration({ sourceCommit, sourceSql });
  const outputPath = resolve(outputDirectory, fileName);
  await writeFile(outputPath, packagedSql, "utf8");
  packagedMigrations.push({ fileName, sourceChecksum, packagedSql, outputPath });
}

const finalExecutionSql = executionPackage({ sourceCommit, packagedMigrations });
const executionPath = resolve(outputDirectory, "gate-a-execution.sql");
await writeFile(executionPath, finalExecutionSql, "utf8");

console.log(JSON.stringify({
  sourceCommit,
  migrations: packagedMigrations.map(({ fileName, sourceChecksum, packagedSql, outputPath }) => ({
    fileName,
    sourceChecksum,
    packageChecksum: sha256(packagedSql),
    outputPath,
  })),
  executionPath,
  executionChecksum: sha256(finalExecutionSql),
}, null, 2));
