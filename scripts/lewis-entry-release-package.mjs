import { createHash } from "node:crypto";

export const lewisEntryReleaseMigrations = [
  "20260825000000_workspace_integration_vault.sql",
  "20260828000252_lewis_workspace_parity_actions.sql",
  "20260828002432_lewis_connector_capability_gates.sql",
  "20260828004945_lewis_workspace_preference_parity.sql",
  "20260828011121_lewis_connector_release_registry.sql",
  "20260828100646_lewis_assistant_connection_parity.sql",
];

export const lewisEntryBaseline = {
  canonicalResourceUri: "https://workspace.leademergence.com/api/mcp",
  phase0TaskFunction: "workspace.mcp_create_task(text,uuid,text,text,date,text)",
  missingBeforeRelease: [
    "workspace_private.integration_credentials",
    "workspace_private.integration_oauth_attempts",
    "workspace.mcp_list_captures(text,timestamptz,uuid,integer)",
    "workspace.mcp_list_assistant_connections()",
  ],
};

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

function migrationHeader(sourceCommit, sourceChecksum) {
  return [
    "-- LEWIS ENTRY RELEASE MIGRATION",
    "-- SOURCE REPOSITORY: abostwick12/lead-emergence-workspace",
    `-- SOURCE COMMIT: ${sourceCommit}`,
    `-- SOURCE CHECKSUM: ${sourceChecksum}`,
  ].join("\n");
}

export function packageMigration({ sourceCommit, sourceSql }) {
  const sourceChecksum = sha256(sourceSql);
  return {
    sourceChecksum,
    packagedSql: `${migrationHeader(sourceCommit, sourceChecksum)}\n\n${sourceSql}`,
  };
}

export function entryPreflightSql() {
  return [
    "-- LEWIS ENTRY RELEASE PREFLIGHT",
    "-- Read-only. Run only against the selected Entry target before executing the release package.",
    "select jsonb_build_object(",
    "  'mcp_resource_uri', (select setting_value from workspace_private.product_settings where setting_key = 'mcp_resource_uri'),",
    `  'phase0_task_function_exists', to_regprocedure('${lewisEntryBaseline.phase0TaskFunction}') is not null,`,
    "  'integration_credentials_exists', to_regclass('workspace_private.integration_credentials') is not null,",
    "  'integration_oauth_attempts_exists', to_regclass('workspace_private.integration_oauth_attempts') is not null,",
    "  'parity_capture_function_exists', to_regprocedure('workspace.mcp_list_captures(text,timestamptz,uuid,integer)') is not null,",
    "  'assistant_connection_function_exists', to_regprocedure('workspace.mcp_list_assistant_connections()') is not null",
    ") as readiness;",
    "",
  ].join("\n");
}

export function executionPackage({ sourceCommit, packagedMigrations }) {
  const manifest = packagedMigrations
    .map(({ fileName, sourceChecksum }) => `-- MIGRATION: ${fileName} SHA-256: ${sourceChecksum}`)
    .join("\n");
  const migrationSql = packagedMigrations
    .map(({ fileName, packagedSql }) => `-- BEGIN ${fileName}\n${packagedSql}\n-- END ${fileName}`)
    .join("\n\n");

  return [
    "-- LEWIS ENTRY RELEASE PACKAGE",
    "-- SOURCE REPOSITORY: abostwick12/lead-emergence-workspace",
    `-- WORKSPACE SOURCE COMMIT: ${sourceCommit}`,
    "-- TARGET BASELINE: Entry has the canonical MCP resource and Phase 0 task actions, but lacks the integration vault and Lewis parity controls.",
    "-- APPLY ONLY after the adjacent preflight matches this baseline and the recorded production gate permits execution.",
    manifest,
    "",
    "begin;",
    "",
    migrationSql,
    "",
    "notify pgrst, 'reload schema';",
    "commit;",
    "",
  ].join("\n");
}
