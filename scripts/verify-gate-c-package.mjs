import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildPackage, sha256 } from "./gate-c-package.mjs";

const [observedAt, sourceCommit] = process.argv.slice(2);
const packagingToolChecksums = Object.fromEntries(await Promise.all([
  "build-gate-c-package.mjs",
  "gate-c-package.mjs",
  "verify-gate-c-package.mjs",
  "verify-gate-c-source-build.mjs"
].map(async (name) => [name, sha256(await readFile(new URL(`./${name}`, import.meta.url)))])));
const expected = await buildPackage({ observedAt, sourceCommit, packagingToolChecksums });
for (const [name, content] of Object.entries(expected)) {
  if (name === "packageChecksum" || name === "checksums") continue;
  const actual = await readFile(resolve("artifacts/gate-c", name), "utf8");
  if (actual !== content) throw new Error(`${name} is not byte-for-byte equivalent to deterministic output.`);
}
console.log(JSON.stringify({ verified: true, packageChecksum: expected.packageChecksum, checksums: expected.checksums }, null, 2));
