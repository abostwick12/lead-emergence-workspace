import { randomUUID, randomInt } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const candidate = "20261014101027_preview_first_party_auth_local_validation.sql";
const fixtures = ["preview_first_party_auth.sql", "workspace_productization.sql"];
const excluded = "realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor";

// Only copies repository-owned source into a fresh local workdir. Never copies
// a linked project's .temp directory, credentials, .env files or remote config.
export function validateCandidate({ repoRoot, portBase = randomInt(20000, 60000), run = spawnSync }) {
  if (!Number.isInteger(portBase) || portBase < 1024 || portBase > 65000) {
    throw new Error("port-base must be an integer between 1024 and 65000.");
  }
  const lab = mkdtempSync(join(tmpdir(), "preview-auth-candidate-"));
  const projectId = `preview-auth-${randomUUID()}`;
  const cli = process.platform === "win32" ? "supabase.exe" : "supabase";
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(SUPABASE_|PG)/i.test(key)) delete env[key];
  }
  let attemptedStart = false;
  let cleanupFailed = false;
  function command(args) {
    const result = run(cli, args, { cwd: lab, env, encoding: "utf8", shell: false });
    // Start/reset can print generated local credentials; do not echo them.
    if (args[0] === "test" && result.stdout) process.stdout.write(result.stdout);
    if (result.error || result.status !== 0) {
      throw new Error(`Local Supabase ${args.slice(0, 2).join(" ")} failed (${result.error?.code ?? result.status}).`);
    }
  }
  try {
    mkdirSync(join(lab, "supabase", "migrations"), { recursive: true });
    mkdirSync(join(lab, "supabase", "tests", "database"), { recursive: true });
    const original = readFileSync(join(repoRoot, "supabase", "config.toml"), "utf8");
    if (!/^project_id\s*=\s*"[^"]+"/m.test(original)) throw new Error("Missing local project_id.");
    const ports = [...original.matchAll(/^\s*(?:port|shadow_port)\s*=\s*(\d+)\s*$/gm)].map(m => Number(m[1]));
    if (!ports.length) throw new Error("Missing local port configuration.");
    const firstPort = Math.min(...ports);
    const config = original.replace(/^project_id\s*=\s*"[^"]+"/m, `project_id = "${projectId}"`)
      .replace(/^(\s*(?:port|shadow_port)\s*=\s*)(\d+)(\s*)$/gm, (_all, prefix, value, suffix) => {
        const port = portBase + Number(value) - firstPort;
        if (port > 65535) throw new Error("Local port range exceeds 65535.");
        return `${prefix}${port}${suffix}`;
      });
    writeFileSync(join(lab, "supabase", "config.toml"), config);
    copyFileSync(join(repoRoot, "supabase", "seed.sql"), join(lab, "supabase", "seed.sql"));
    for (const entry of readdirSync(join(repoRoot, "supabase", "migrations"), { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".sql")) {
        copyFileSync(join(repoRoot, "supabase", "migrations", entry.name), join(lab, "supabase", "migrations", entry.name));
      }
    }
    copyFileSync(join(repoRoot, "supabase", "tests", "database", fixtures[0]), join(lab, "supabase", "tests", "database", fixtures[0]));
    copyFileSync(join(repoRoot, "supabase", "tests", "candidates", fixtures[1]), join(lab, "supabase", "tests", "database", fixtures[1]));
    attemptedStart = true;
    command(["start", "--exclude", excluded]);
    copyFileSync(join(repoRoot, "supabase", "candidates", candidate), join(lab, "supabase", "migrations", candidate));
    command(["db", "reset", "--local"]);
    command(["test", "db", "--local", ...fixtures.map(name => `supabase/tests/database/${name}`)]);
  } finally {
    if (attemptedStart) {
      try { command(["stop", "--project-id", projectId, "--no-backup"]); }
      catch (error) {
        cleanupFailed = true;
        throw new Error(`${error.message} Inspect owned project ${projectId}; workdir retained at ${lab}.`);
      }
    }
    if (!cleanupFailed) rmSync(lab, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length && !/^--port-base=\d+$/.test(args[0]))) {
      throw new Error("Usage: npm run test:rls:candidate -- [--port-base=40000]");
    }
    validateCandidate({ repoRoot: resolve(dirname(fileURLToPath(import.meta.url)), ".."),
      ...(args.length ? { portBase: Number(args[0].split("=")[1]) } : {}) });
    console.log("Candidate fixtures passed; owned disposable stack and workdir removed.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
