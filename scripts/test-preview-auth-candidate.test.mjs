import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateCandidate } from "./test-preview-auth-candidate.mjs";

const candidate = "20261014101027_preview_first_party_auth_local_validation.sql";
function source() {
  const root = mkdtempSync(join(tmpdir(), "preview-runner-test-"));
  const files = {
    "supabase/config.toml": 'project_id = "existing-owned-elsewhere"\n[db]\nport = 56422\nshadow_port = 56420\n',
    "supabase/seed.sql": "-- seed\n",
    "supabase/migrations/20260101000000_ordinary.sql": "-- ordinary SQL\n",
    [`supabase/candidates/${candidate}`]: "-- candidate SQL\n",
    "supabase/tests/database/preview_first_party_auth.sql": "-- Preview tests\n",
    "supabase/tests/database/workspace_productization.sql": "-- ordinary assertions\n",
    "supabase/tests/candidates/workspace_productization.sql": "-- strict candidate assertions\n",
    "supabase/.temp/project-ref": "must-not-copy",
    ".env.local": "must-not-copy"
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

test("stages exact candidate bytes only in a fresh lab, selects both fixtures, and removes owned resources", () => {
  const root = source(); const calls = []; let lab;
  try {
    validateCandidate({ repoRoot: root, portBase: 41000, run: (_cli, args, options) => {
      lab = options.cwd; calls.push(args);
      assert.notEqual(lab, root);
      assert.equal(options.shell, false);
      assert.equal(existsSync(join(lab, "supabase/.temp")), false);
      assert.equal(existsSync(join(lab, ".env.local")), false);
      assert.ok(!Object.keys(options.env).some(key => /^(SUPABASE_|PG)/i.test(key)));
      const config = readFileSync(join(lab, "supabase/config.toml"), "utf8");
      assert.match(config, /project_id = "preview-auth-[a-f0-9-]+"/);
      assert.match(config, /port = 41002/);
      if (args[0] === "start") assert.equal(readdirSync(join(lab, "supabase/migrations")).length, 1);
      if (args[0] === "db") {
        assert.deepEqual(args, ["db", "reset", "--local"]);
        assert.equal(readFileSync(join(lab, "supabase/migrations", candidate), "utf8"), "-- candidate SQL\n");
        assert.equal(readFileSync(join(lab, "supabase/tests/database/workspace_productization.sql"), "utf8"), "-- strict candidate assertions\n");
      }
      return { status: 0, stdout: "" };
    } });
    assert.deepEqual(calls[2], ["test", "db", "--local", "supabase/tests/database/preview_first_party_auth.sql", "supabase/tests/database/workspace_productization.sql"]);
    assert.equal(calls[3][0], "stop");
    assert.match(calls[3][2], /^preview-auth-/);
    assert.equal(calls[3][3], "--no-backup");
    assert.equal(existsSync(lab), false);
    assert.equal(existsSync(join(root, "supabase/migrations", candidate)), false);
    assert.equal(readFileSync(join(root, "supabase/tests/database/workspace_productization.sql"), "utf8"), "-- ordinary assertions\n");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a failed start still cleans only its own project and does not reset or test", () => {
  const root = source(); const calls = []; let lab;
  try {
    assert.throws(() => validateCandidate({ repoRoot: root, run: (_cli, args, options) => {
      lab = options.cwd; calls.push(args[0]);
      return { status: args[0] === "start" ? 1 : 0 };
    } }), /start.*failed/);
    assert.deepEqual(calls, ["start", "stop"]);
    assert.equal(existsSync(lab), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a candidate-install failure stops the owned stack and skips assertions", () => {
  const root = source(); const calls = [];
  try {
    assert.throws(() => validateCandidate({ repoRoot: root, run: (_cli, args) => {
      calls.push(args[0]); return { status: args[0] === "db" ? 1 : 0 };
    } }), /reset.*failed/);
    assert.deepEqual(calls, ["start", "db", "stop"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("invalid ports fail before any CLI call", () => {
  assert.throws(() => validateCandidate({ repoRoot: "/unused", portBase: 65536, run: () => assert.fail("CLI must not run") }), /port-base/);
});

test("a cleanup failure retains the owned workdir for recovery", () => {
  const root = source(); let lab;
  try {
    assert.throws(() => validateCandidate({ repoRoot: root, run: (_cli, args, options) => {
      lab = options.cwd; return { status: args[0] === "stop" ? 1 : 0 };
    } }), /workdir retained/);
    assert.equal(existsSync(lab), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
    if (lab) rmSync(lab, { recursive: true, force: true });
  }
});
