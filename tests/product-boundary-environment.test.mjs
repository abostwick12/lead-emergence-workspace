import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const checker = fileURLToPath(new URL("../scripts/check-product-boundaries.mjs", import.meta.url));

function scan(source) {
  const root = mkdtempSync(join(tmpdir(), "workspace-boundary-"));
  try {
    for (const path of ["app", "components", "lib", "supabase/functions"]) {
      mkdirSync(join(root, path), { recursive: true });
    }
    writeFileSync(join(root, "app/probe.ts"), source);
    return spawnSync(process.execPath, [checker], { cwd: root, encoding: "utf8" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("rejects a computed service-role key through a constant and env alias", () => {
  for (const source of [
    'const key = "SUPABASE_" + "SERVICE_ROLE_KEY"; process.env[key];',
    'const env = process.env; env[`SUPABASE_` + "SERVICE_ROLE_KEY"];',
    'process["env"]["SUPABASE_" + "SERVICE_ROLE_KEY"];',
    'const key = `SUPABASE_${"SERVICE_ROLE_KEY"}`; required(key);'
  ]) {
    const result = scan(source);
    assert.notEqual(result.status, 0, source);
    assert.match(result.stderr, /computed service-role environment access/);
  }
});

test("allows the existing named environment helper and harmless computed keys", () => {
  const result = scan('function required(name: string) { return process.env[name]; }\nprocess.env["NEXT_PUBLIC_" + "APP_URL"];');
  assert.equal(result.status, 0, result.stderr);
});
