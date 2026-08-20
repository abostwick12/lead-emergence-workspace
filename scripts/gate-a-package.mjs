import { createHash } from "node:crypto";

export const gateAMigrations = [
  "20260820000000_workspace_foundation.sql",
  "20260820000001_workspace_gate_a_cross_product_hardening.sql",
];

export function normalizeSql(sql) {
  return sql.replaceAll("\r\n", "\n");
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function validateSourceProvenance(fileName, sql) {
  if (/^-- SOURCE (?:REPOSITORY|COMMIT|CHECKSUM):/mi.test(sql)) {
    throw new Error(`${fileName} must not contain generated source provenance metadata.`);
  }
  if (/\bUNCOMMITTED\b/i.test(sql)) {
    throw new Error(`${fileName} contains an UNCOMMITTED provenance marker.`);
  }
}

export function packageHeader(sourceCommit, sourceChecksum) {
  return [
    "-- SHARED MIGRATION PACKAGE",
    "-- SOURCE REPOSITORY: abostwick12/lead-emergence-workspace",
    `-- SOURCE COMMIT: ${sourceCommit}`,
    `-- SOURCE CHECKSUM: ${sourceChecksum}`,
  ].join("\n");
}

export function packageMigration({ sourceCommit, sourceSql }) {
  const sourceChecksum = sha256(sourceSql);
  return {
    sourceChecksum,
    packagedSql: `${packageHeader(sourceCommit, sourceChecksum)}\n\n${sourceSql}`,
  };
}

export function executionPackage({ sourceCommit, packagedMigrations }) {
  const manifest = packagedMigrations
    .map(({ fileName, sourceChecksum }) => `-- MIGRATION: ${fileName} SHA-256: ${sourceChecksum}`)
    .join("\n");
  const migrationSql = packagedMigrations
    .map(({ fileName, packagedSql }) => `-- BEGIN ${fileName}\n${packagedSql}\n-- END ${fileName}`)
    .join("\n\n");

  return [
    "-- GATE A EXECUTION PACKAGE",
    "-- SOURCE REPOSITORY: abostwick12/lead-emergence-workspace",
    `-- WORKSPACE SOURCE COMMIT: ${sourceCommit}`,
    "-- PACKAGE CONTENT: the two reviewed Gate A migrations followed by the approved Data API setting.",
    manifest,
    "",
    "begin;",
    "",
    migrationSql,
    "",
    "alter role authenticator in database postgres set pgrst.db_schemas = 'public,workspace';",
    "notify pgrst, 'reload config';",
    "commit;",
    "",
  ].join("\n");
}
