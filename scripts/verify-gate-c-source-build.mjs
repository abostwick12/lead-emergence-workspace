import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function run(command, args, cwd) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd, env: process.env, stdio: "inherit" });
    child.on("error", rejectRun);
    child.on("exit", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} ${args.join(" ")} exited with code ${code}.`));
    });
  });
}

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifestPath = resolve(repositoryRoot, "artifacts/gate-c/gate-c-source-bundle.json");
const bundle = JSON.parse(await readFile(manifestPath, "utf8"));
const stagingDirectory = await mkdtemp(join(tmpdir(), "lead-emergence-gate-c-"));

for (const [relativePath, expectedChecksum] of Object.entries(bundle.files)) {
  const normalized = normalize(relativePath);
  if (isAbsolute(normalized) || normalized.startsWith("..") || normalized.includes(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error(`Unsafe source path: ${relativePath}`);
  }
  const sourcePath = resolve(repositoryRoot, normalized);
  const destinationPath = resolve(stagingDirectory, normalized);
  await mkdir(dirname(destinationPath), { recursive: true });
  const content = await readFile(sourcePath);
  const actualChecksum = sha256(content);
  if (actualChecksum !== expectedChecksum) throw new Error(`${relativePath} does not match the locked checksum.`);
  await copyFile(sourcePath, destinationPath);
}

const npmCliPath = process.env.npm_execpath;
if (!npmCliPath) throw new Error("Run this verifier through the npm package script so npm_execpath is available.");
await run(process.execPath, [npmCliPath, "ci"], stagingDirectory);
await run(process.execPath, [npmCliPath, "run", "build"], stagingDirectory);

console.log(JSON.stringify({
  verified: true,
  stagingDirectory,
  fileCount: Object.keys(bundle.files).length,
  sourceBundleChecksum: bundle.checksum
}, null, 2));
