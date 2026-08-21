import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const sourceRepository = "abostwick12/lead-emergence-workspace";
export const productionProjectRef = "cirqqhuvzekbvysiyedg";
export const clockPreferencesMigration = "20260821172607_workspace_clock_preferences.sql";
const execFileAsync = promisify(execFile);

export function normalizeText(value) {
  return value.replaceAll("\r\n", "\n");
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function committedMigration(sourceCommit) {
  if (!/^[0-9a-f]{40}$/.test(sourceCommit ?? "")) throw new Error("A full 40-character source commit is required.");
  const { stdout: head } = await execFileAsync("git", ["rev-parse", "HEAD"]);
  if (head.trim() !== sourceCommit) throw new Error("Build Gate D only from the current committed Workspace HEAD.");
  const sourcePath = `supabase/migrations/${clockPreferencesMigration}`;
  const { stdout } = await execFileAsync("git", ["show", `${sourceCommit}:${sourcePath}`], { maxBuffer: 1024 * 1024 });
  const migration = normalizeText(stdout);
  if (/^-- SOURCE (?:REPOSITORY|COMMIT|CHECKSUM):/mi.test(migration) || /\bUNCOMMITTED\b/i.test(migration)) {
    throw new Error("The authoritative migration must not contain generated provenance metadata.");
  }
  return migration;
}

export function packageMigration(sourceCommit, migration) {
  const sourceChecksum = sha256(migration);
  return {
    sourceChecksum,
    sql: [
      "-- GATE D HOSTED MIGRATION PACKAGE",
      `-- SOURCE REPOSITORY: ${sourceRepository}`,
      `-- SOURCE COMMIT: ${sourceCommit}`,
      `-- SOURCE MIGRATION: ${clockPreferencesMigration}`,
      `-- SOURCE CHECKSUM: ${sourceChecksum}`,
      "-- APPLY ONLY THROUGH THE MINISTRY-OWNED REVIEWED HOSTED MIGRATION PATH.",
      "",
      migration
    ].join("\n")
  };
}

export function preflightSql() {
  return normalizeText(`-- READ-ONLY Gate D Workspace clock-preference preflight.
with checks(check_name, passed) as (
  values
    ('workspace_user_profiles_present', to_regclass('workspace.user_profiles') is not null),
    ('primary_timezone_present', exists (
      select 1 from information_schema.columns
      where table_schema = 'workspace' and table_name = 'user_profiles' and column_name = 'timezone'
    )),
    ('clock_preferences_absent', not exists (
      select 1 from information_schema.columns
      where table_schema = 'workspace' and table_name = 'user_profiles' and column_name = 'clock_timezones'
    )),
    ('user_profiles_rls_enabled', coalesce((
      select relrowsecurity from pg_class where oid = 'workspace.user_profiles'::regclass
    ), false)),
    ('self_update_policy_present', exists (
      select 1 from pg_policy
      where polrelid = 'workspace.user_profiles'::regclass
        and polname = 'user_profiles_update_self'
    ))
)
select count(*) as checks_run,
       bool_and(passed) as all_passed,
       coalesce(jsonb_agg(check_name order by check_name) filter (where not passed), '[]'::jsonb) as failed_checks
from checks;
`);
}

export function postflightSql() {
  return normalizeText(`-- READ-ONLY Gate D Workspace clock-preference postflight.
with checks(check_name, passed) as (
  values
    ('primary_timezone_preserved', exists (
      select 1 from information_schema.columns
      where table_schema = 'workspace' and table_name = 'user_profiles'
        and column_name = 'timezone' and is_nullable = 'NO'
    )),
    ('clock_preferences_present', exists (
      select 1 from information_schema.columns
      where table_schema = 'workspace' and table_name = 'user_profiles'
        and column_name = 'clock_timezones' and udt_name = '_text' and is_nullable = 'NO'
    )),
    ('clock_preferences_default_present', exists (
      select 1 from information_schema.columns
      where table_schema = 'workspace' and table_name = 'user_profiles'
        and column_name = 'clock_timezones'
        and column_default like '%America/New_York%'
        and column_default like '%America/Chicago%'
        and column_default like '%America/Los_Angeles%'
    )),
    ('exactly_three_constraint_present', exists (
      select 1 from pg_constraint
      where conrelid = 'workspace.user_profiles'::regclass
        and conname = 'user_profiles_clock_timezones_exactly_three'
        and convalidated
    )),
    ('user_profiles_rls_preserved', coalesce((
      select relrowsecurity from pg_class where oid = 'workspace.user_profiles'::regclass
    ), false)),
    ('self_policies_preserved', (
      select count(*) = 3 from pg_policy
      where polrelid = 'workspace.user_profiles'::regclass
        and polname in ('user_profiles_select_self', 'user_profiles_insert_self', 'user_profiles_update_self')
    ))
)
select count(*) as checks_run,
       bool_and(passed) as all_passed,
       coalesce(jsonb_agg(check_name order by check_name) filter (where not passed), '[]'::jsonb) as failed_checks
from checks;
`);
}

export async function buildGateDPackage(sourceCommit) {
  const migration = await committedMigration(sourceCommit);
  const packagedMigration = packageMigration(sourceCommit, migration);
  const preflight = preflightSql();
  const postflight = postflightSql();
  const checksums = {
    sourceMigration: packagedMigration.sourceChecksum,
    hostedMigration: sha256(packagedMigration.sql),
    preflight: sha256(preflight),
    postflight: sha256(postflight)
  };
  const manifest = `${JSON.stringify({
    package: "gate-d-workspace-clock-preferences-v1",
    productionProjectRef,
    sourceRepository,
    sourceCommit,
    sourceMigration: clockPreferencesMigration,
    checksums,
    executionBoundary: "Ministry-owned reviewed hosted migration path only; never Supabase link, db push, or migration repair from Workspace",
    rollback: "Roll back the application deployment; retain the additive preference column and all values. No data deletion is required."
  }, null, 2)}\n`;
  return {
    "workspace-clock-preferences.sql": packagedMigration.sql,
    "preflight.sql": preflight,
    "postflight.sql": postflight,
    "manifest.json": manifest,
    checksums,
    packageChecksum: sha256(`${manifest}${packagedMigration.sql}${preflight}${postflight}`)
  };
}
