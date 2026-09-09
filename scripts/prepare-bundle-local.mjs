import { mkdir, readFile, readdir, copyFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const target = resolve(".bundle-local/supabase");
await mkdir(resolve(target, "migrations"), { recursive: true });
const configuration = (await readFile("supabase/config.toml", "utf8"))
  .replace('project_id = "lead-emergence-workspace-local"', 'project_id = "bundle-experience-p2"')
  .replaceAll("5642", "5852").replaceAll("localhost:3000", "localhost:3125")
  .replaceAll("127.0.0.1:3000", "127.0.0.1:3125");
await writeFile(resolve(target, "config.toml"), configuration);
for (const file of await readdir("supabase/migrations")) {
  if (file.endsWith(".sql")) await copyFile(resolve("supabase/migrations", file), resolve(target, "migrations", file));
}
await copyFile("supabase/seed.sql", resolve(target, "seed.sql"));
console.log("Prepared isolated bundle-experience-p2 stack on ports 58520–58527.");
