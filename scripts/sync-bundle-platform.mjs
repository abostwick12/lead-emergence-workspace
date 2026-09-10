import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// An explicit, reproducible source export keeps the private catalog independent
// of the Workspace build and never copies client configuration or credentials.
const source = resolve(process.argv[2] || "../lead-emergence-bundles");
const destination = resolve("vendor/lead-emergence-bundles");
const gitArgs = ["-c", `safe.directory=${source.replaceAll("\\", "/")}`];
const sourceRevision = execFileSync("git", [...gitArgs, "rev-parse", "HEAD"], { cwd: source, encoding: "utf8" }).trim();
const packages = ["bundle-contract", "bundle-registry", "capability-registry", "policy", "provenance", "provider-contracts", "ui-manifest", "workflow-runtime"];
const entries = packages.map((name) => [`packages/${name}/src/index.ts`, `${name}/index.ts`]);
entries.push(["apps/lead-emergence-runtime/src/index.ts", "runtime/index.ts"]);
entries.push(["bundles/editor-recovery.ts", "domain-contracts/editor-recovery.ts"]);
entries.push(["bundles/value-pilot.ts", "domain-contracts/value-pilot.ts"]);
for (const file of ["bundle.json", "ui-manifest.json"]) entries.push([`bundles/writer-editor/${file}`, `bundles/writer-editor/${file}`]);
entries.push(["bundles/ministry/bundle.json", "catalog/ministry-bundle.json"],
  ["bundles/ministry/ui-manifest.json", "catalog/ministry-ui.json"],
  ["bundles/ministry/contracts.ts", "domain-contracts/ministry.ts"]);
entries.push(["bundles/nonprofit-founder/bundle.json", "catalog/nonprofit-bundle.json"],
  ["bundles/nonprofit-founder/ui-manifest.json", "catalog/nonprofit-ui.json"],
  ["bundles/nonprofit-founder/contracts.ts", "domain-contracts/nonprofit.ts"]);
entries.push(["bundles/investor/bundle.json", "catalog/investor-bundle.json"],
  ["bundles/investor/ui-manifest.json", "catalog/investor-ui.json"],
  ["bundles/investor/contracts.ts", "domain-contracts/investor.ts"],
  ["bundles/investor/analysis.ts", "domain-contracts/investor-analysis.ts"]);
entries.push(["bundles/executive/bundle.json", "catalog/executive-bundle.json"],
  ["bundles/executive/ui-manifest.json", "catalog/executive-ui.json"],
  ["bundles/executive/contracts.ts", "domain-contracts/executive.ts"],
  ["bundles/executive/analysis.ts", "domain-contracts/executive-analysis.ts"],
  ["bundles/executive/scheduling.ts", "domain-contracts/executive-scheduling.ts"],
  ["bundles/executive/attention.ts", "domain-contracts/executive-attention.ts"],
  ["bundles/executive/weekly.ts", "domain-contracts/executive-weekly.ts"]);
entries.push(["bundles/workspace-experience/bundle.json", "catalog/workspace-experience-bundle.json"],
  ["bundles/workspace-experience/ui-manifest.json", "catalog/workspace-experience-ui.json"],
  ["bundles/workspace-experience/layout.ts", "domain-contracts/workspace-layout.ts"],
  ["bundles/workspace-experience/discovery.ts", "domain-contracts/workspace-discovery.ts"],
  ["bundles/workspace-experience/attention.ts", "domain-contracts/workspace-attention.ts"],
  ["bundles/workspace-experience/notifications.ts", "domain-contracts/workspace-notifications.ts"],
  ["bundles/workspace-experience/connections.ts", "domain-contracts/workspace-connections.ts"]);
execFileSync("git", [...gitArgs, "diff", "--exit-code", "HEAD", "--", ...entries.map(([path]) => path)], { cwd: source });
const files = [];
for (const [sourcePath, outputPath] of entries) {
  const original = await readFile(resolve(source, sourcePath), "utf8");
  let content = original.replaceAll("\r\n", "\n").replace(/@lead-emergence\/([a-z-]+)/g, "../$1/index");
  if (sourcePath === "bundles/workspace-experience/attention.ts") content = content.replaceAll('from "./discovery"', 'from "./workspace-discovery"');
  if (sourcePath === "bundles/investor/analysis.ts") content = content.replace('from "./contracts"', 'from "./investor"');
  if (sourcePath === "bundles/editor-recovery.ts") for (const [folder, name] of [["ministry", "ministry"], ["nonprofit-founder", "nonprofit"], ["investor", "investor"], ["executive", "executive"]]) content = content.replace('from "./' + folder + '/contracts"', 'from "./' + name + '"');
  if (sourcePath.startsWith("bundles/executive/") && sourcePath.endsWith(".ts")) content = content.replaceAll('from "./contracts"', 'from "./executive"');
  const target = resolve(destination, outputPath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
  files.push({ sourcePath, outputPath, sha256: createHash("sha256").update(content).digest("hex") });
}
await writeFile(resolve(destination, "source-lock.json"), JSON.stringify({
  repository: "abostwick12/lead-emergence-bundles", sourceRevision, contractVersion: "1.0", files
}, null, 2) + "\n");
console.log(`Exported ${files.length} allowlisted platform files from ${sourceRevision}.`);
