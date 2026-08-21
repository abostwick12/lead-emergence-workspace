import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildGateDPackage } from "./gate-d-package.mjs";

const [sourceCommit] = process.argv.slice(2);
const pkg = await buildGateDPackage(sourceCommit);
const outputDirectory = resolve("artifacts/gate-d");
await mkdir(outputDirectory, { recursive: true });
for (const [name, content] of Object.entries(pkg)) {
  if (name === "checksums" || name === "packageChecksum") continue;
  await writeFile(resolve(outputDirectory, name), content, "utf8");
}
console.log(JSON.stringify({ outputDirectory, packageChecksum: pkg.packageChecksum, checksums: pkg.checksums }, null, 2));
