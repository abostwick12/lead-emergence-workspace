import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const skippedDirectories = new Set([".git", ".next", ".bundle-local", ".validator-deps", ".validator-deps-local", "artifacts", "coverage", "node_modules", "playwright-report", "test-results"]);
const findings = [];
const patterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub token", /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{16,}\b/],
  ["OpenAI-style API key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{20,}\b/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ["credential-bearing connection string", /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:/]+:[^\s@]+@/i],
  ["SSN", /\b\d{3}-\d{2}-\d{4}\b/],
  ["US phone number", /\b(?:\+1[ .-]?)?(?:\(?\d{3}\)?[ .-]?)\d{3}[ .-]\d{4}\b/]
];
const assignedSecret = /(?:^|[\s,{])(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|secret|password)\s*[:=]\s*["']([^"'\s]{8,})["']/gim;
const dotenvSecret = /^(?!NEXT_PUBLIC_)([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)=([^\s#]{8,})/gim;
const explicitFixtureValues = new Map([
  ["scripts/test-bundle-pilot-local.mjs", new Set(["BundlePilotOperator!2026", "BundlePilotFounder!2026", "BundlePilotInvitee!2026"])],
  ["tests/harness/session.ts", new Set(["synthetic-local-session"])],
  ["tests/integration-crypto.test.ts", new Set(["integration-test-secret-that-is-long-enough-to-be-safe"])]
]);

function isExplicitFixture(label, value) {
  const path = label.includes(":") ? label.slice(label.indexOf(":") + 1) : label;
  return explicitFixtureValues.get(path)?.has(value) === true;
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) files.push(...walk(join(directory, entry.name)));
    } else if (entry.isFile()) {
      files.push(join(directory, entry.name));
    }
  }
  return files;
}

function inspect(label, source) {
  if (source.includes("\u0000")) return;
  for (const [kind, pattern] of patterns) {
    const match = source.match(pattern);
    if (match) findings.push(`${label}: ${kind} (${match[0].slice(0, 24)}…)`);
  }
  assignedSecret.lastIndex = 0;
  for (let assignedMatch = assignedSecret.exec(source); assignedMatch; assignedMatch = assignedSecret.exec(source)) {
    if (!isExplicitFixture(label, assignedMatch[1])) findings.push(`${label}: assigned secret-like value (${assignedMatch[1].slice(0, 8)}…)`);
  }
  dotenvSecret.lastIndex = 0;
  for (let dotenvMatch = dotenvSecret.exec(source); dotenvMatch; dotenvMatch = dotenvSecret.exec(source)) {
    if (!dotenvMatch[1].endsWith("_KEY_ID") && !isExplicitFixture(label, dotenvMatch[2])) {
      findings.push(`${label}: assigned secret-like value (${dotenvMatch[2].slice(0, 8)}…)`);
    }
  }
}

for (const file of walk(root)) {
  const label = relative(root, file).replaceAll("\\", "/");
  inspect(label, readFileSync(file, "utf8"));
}

const revisions = execFileSync("git", ["rev-list", "HEAD"], { encoding: "utf8" })
  .trim()
  .split(/\s+/)
  .filter(Boolean);

// Scan every unique blob reachable from every preserved ref. Git's batch
// protocol avoids spawning one process per file per revision while preserving
// the original all-history coverage.
const reachable = execFileSync("git", ["rev-list", "--objects", "HEAD"], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);
const labels = new Map();
for (const line of reachable) {
  const separator = line.indexOf(" ");
  const objectId = separator === -1 ? line : line.slice(0, separator);
  if (!labels.has(objectId)) labels.set(objectId, separator === -1 ? "" : line.slice(separator + 1));
}

const objectIds = [...labels.keys()];
const check = spawnSync("git", ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], {
  input: objectIds.join("\n") + "\n",
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024
});
if (check.status !== 0) throw new Error(check.stderr || "Unable to inspect Git object types.");
const blobIds = check.stdout.trim().split("\n").filter((line) => line.split(" ")[1] === "blob").map((line) => line.split(" ")[0]);
const batch = spawnSync("git", ["cat-file", "--batch"], {
  input: blobIds.join("\n") + "\n",
  encoding: null,
  maxBuffer: 256 * 1024 * 1024
});
if (batch.status !== 0) throw new Error(batch.stderr?.toString("utf8") || "Unable to read Git blobs.");

let offset = 0;
for (const expectedId of blobIds) {
  const newline = batch.stdout.indexOf(10, offset);
  if (newline === -1) throw new Error("Git batch output ended before its header.");
  const [objectId, type, sizeText] = batch.stdout.subarray(offset, newline).toString("utf8").split(" ");
  const size = Number(sizeText);
  if (objectId !== expectedId || type !== "blob" || !Number.isSafeInteger(size)) throw new Error("Git batch output was malformed.");
  const start = newline + 1;
  const end = start + size;
  inspect(`${objectId.slice(0, 12)}:${labels.get(objectId) || "blob"}`, batch.stdout.subarray(start, end).toString("utf8"));
  offset = end + 1;
}

if (findings.length) {
  console.error("Sensitive-data scan failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log(`Sensitive-data scan passed: ${revisions.length} release-lineage commit(s), ${blobIds.length} unique Git blob(s), and the working tree scanned (dependency/build output excluded).`);
