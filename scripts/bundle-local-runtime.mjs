import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

export const appUrl = "http://localhost:3125";
export const containerName = "supabase_db_bundle-experience-p2";
export async function localConfiguration() {
  const source = await readFile(".bundle-local/supabase/config.toml", "utf8");
  if (!source.includes('project_id = "bundle-experience-p2"') || !source.includes("port = 58421")) {
    throw new Error("Only the isolated P2 stack is allowed.");
  }
  const text = execFileSync(process.platform === "win32" ? "supabase.exe" : "supabase",
    ["status", "--workdir", ".bundle-local", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const config = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  if (config.API_URL !== "http://127.0.0.1:58421") throw new Error("Refusing a non-P2 database.");
  return config;
}
export function localSql(sql) {
  return execFileSync(process.platform === "win32" ? "docker.exe" : "docker",
    ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"],
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}
export function publicClient(config) {
  return createClient(config.API_URL, config.ANON_KEY, {
    db: { schema: "workspace" }, auth: { persistSession: false, autoRefreshToken: false }
  });
}
export async function fixtureSession(config, fixture) {
  const client = publicClient(config);
  const { data, error } = await client.auth.signInWithPassword({ email: fixture.email, password: fixture.password });
  if (error || !data.session) throw new Error("Synthetic fixture sign-in failed.");
  return { client, token: data.session.access_token };
}
