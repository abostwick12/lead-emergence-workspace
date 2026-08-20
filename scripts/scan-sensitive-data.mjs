import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const skippedDirectories = new Set([".git", ".next", "artifacts", "coverage", "node_modules", "playwright-report", "test-results"]);
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
const dotenvSecret = /^(?!NEXT_PUBLIC_)(?:[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)=([^\s#]{8,})/gim;

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
  for (const expression of [assignedSecret, dotenvSecret]) {
    expression.lastIndex = 0;
    const match = expression.exec(source);
    if (match) findings.push(`${label}: assigned secret-like value (${match[1].slice(0, 8)}…)`);
  }
}

for (const file of walk(root)) {
  const label = relative(root, file).replaceAll("\\", "/");
  inspect(label, readFileSync(file, "utf8"));
}

const revisions = execFileSync("git", ["rev-list", "--all"], { encoding: "utf8" })
  .trim()
  .split(/\s+/)
  .filter(Boolean);
for (const revision of revisions) {
  const files = execFileSync("git", ["ls-tree", "-r", "--name-only", revision], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
  for (const file of files) {
    const source = execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" });
    inspect(`${revision.slice(0, 12)}:${file}`, source);
  }
}

if (findings.length) {
  console.error("Sensitive-data scan failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log(`Sensitive-data scan passed: ${revisions.length} preserved commit(s), working tree scanned (dependency/build output excluded).`);
