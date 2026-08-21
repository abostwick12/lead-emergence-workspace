import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildGateDPackage } from "./gate-d-package.mjs";

const [sourceCommit] = process.argv.slice(2);
const expected = await buildGateDPackage(sourceCommit);
for (const [name, content] of Object.entries(expected)) {
  if (name === "checksums" || name === "packageChecksum") continue;
  const actual = await readFile(resolve("artifacts/gate-d", name), "utf8");
  if (actual !== content) throw new Error(`${name} is not byte-for-byte equivalent to deterministic output.`);
}
console.log(JSON.stringify({ verified: true, packageChecksum: expected.packageChecksum, checksums: expected.checksums }, null, 2));
