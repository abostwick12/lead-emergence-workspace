import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildPackage, sha256 } from "./gate-c-package.mjs";

const [observedAt, sourceCommit] = process.argv.slice(2);
const packagingToolChecksums = Object.fromEntries(await Promise.all([
  "build-gate-c-package.mjs",
  "gate-c-package.mjs",
  "verify-gate-c-package.mjs",
  "verify-gate-c-source-build.mjs"
].map(async (name) => [name, sha256(await readFile(new URL(`./${name}`, import.meta.url)))])));
const pkg = await buildPackage({ observedAt, sourceCommit, packagingToolChecksums });
const outputDirectory = resolve("artifacts/gate-c");
await mkdir(outputDirectory, { recursive: true });
for (const [name, content] of Object.entries(pkg)) {
  if (name === "packageChecksum" || name === "checksums") continue;
  await writeFile(resolve(outputDirectory, name), content, "utf8");
}
console.log(JSON.stringify({ outputDirectory, packageChecksum: pkg.packageChecksum, checksums: pkg.checksums }, null, 2));
