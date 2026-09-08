import { spawn } from "node:child_process";
import { localConfiguration } from "./bundle-local-runtime.mjs";
const config = await localConfiguration();
// Only public configuration reaches the app process. Admin keys remain local
// test-runner inputs and are never supplied to the Workspace runtime.
const env = { ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: config.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: config.ANON_KEY,
  NEXT_PUBLIC_APP_URL: "http://localhost:3125", WORKSPACE_MCP_RESOURCE_URI: "https://workspace.leademergence.com/api/mcp"
};
for (const key of Object.keys(env)) if (/SERVICE_ROLE|SECRET_KEY|JWT_SECRET/.test(key)) delete env[key];
const mode = process.argv[2] || "dev";
if (!["dev", "build", "start"].includes(mode)) throw new Error("Use dev, build, or start for the isolated preview.");
const args = mode === "build" ? ["build"] : [mode, "-p", "3125", "--hostname", "127.0.0.1"];
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...args], { env, stdio: "inherit", windowsHide: true });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
