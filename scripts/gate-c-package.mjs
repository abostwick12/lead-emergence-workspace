import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { promisify } from "node:util";

export const productionProjectRef = "cirqqhuvzekbvysiyedg";
export const ownerUserId = "6f2f63f4-9ce2-4cda-85fe-4d808e3e11a0";
export const vercelTeam = Object.freeze({ id: "team_qEmWEp6Jzhtb2XP5c1jL9FB3", slug: "emergence-projects" });
export const vercelProjectName = "lead-emergence-workspace";
export const vercelProjectId = "prj_ANnBP1Pxceok4uezHzHPjOTs2cCb";
export const productionHostname = "lead-emergence-workspace.vercel.app";
export const productionUrl = `https://${productionHostname}`;

const sourceRoots = ["app", "components", "lib", "tests"];
const sourceFiles = [
  ".env.example",
  "eslint.config.mjs",
  "next-env.d.ts",
  "next.config.mjs",
  "package-lock.json",
  "package.json",
  "tsconfig.json",
  "vercel.json",
  "vitest.config.ts"
];
const execFileAsync = promisify(execFile);

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function assertInputs({ observedAt, sourceCommit }) {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(observedAt ?? "")) throw new Error("observedAt must be an ISO timestamp.");
  if (!/^[0-9a-f]{40}$/.test(sourceCommit ?? "")) throw new Error("sourceCommit must be a full 40-character Git commit SHA.");
  const { stdout } = await execFileAsync("git", ["rev-parse", "--verify", `${sourceCommit}^{commit}`], { cwd: process.cwd() });
  if (stdout.trim() !== sourceCommit) throw new Error(`Source commit ${sourceCommit} could not be verified exactly.`);
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = resolve(root, entry.name);
    if (entry.isDirectory()) return listFiles(entryPath);
    return [entryPath];
  }));
  return nested.flat();
}

async function committedPaths(sourceCommit) {
  const { stdout } = await execFileAsync("git", [
    "ls-tree", "-r", "--name-only", sourceCommit, "--", ...sourceRoots, ...sourceFiles
  ], { cwd: process.cwd() });
  return stdout.split(/\r?\n/).filter(Boolean).sort();
}

async function committedBlob(sourceCommit, file) {
  const { stdout } = await execFileAsync("git", ["rev-parse", `${sourceCommit}:${file}`], { cwd: process.cwd() });
  return stdout.trim();
}

async function currentBlob(file) {
  const { stdout } = await execFileAsync("git", ["hash-object", "--", file], { cwd: process.cwd() });
  return stdout.trim();
}

export async function sourceBundle(sourceCommit) {
  const nested = (await Promise.all(sourceRoots.map((root) => listFiles(root)))).flat();
  const files = [...nested, ...sourceFiles.map((file) => resolve(file))]
    .map((file) => relative(process.cwd(), file).replaceAll("\\", "/"))
    .sort();
  const committed = await committedPaths(sourceCommit);
  if (JSON.stringify(committed) !== JSON.stringify(files)) {
    throw new Error("The Gate C source file set does not exactly match the declared committed source state.");
  }
  for (const file of files) {
    if (await currentBlob(file) !== await committedBlob(sourceCommit, file)) {
      throw new Error(`Working-tree source differs from committed provenance for ${file}.`);
    }
  }
  const entries = await Promise.all(files.map(async (file) => [file, sha256(await readFile(file))]));
  const checksums = Object.fromEntries(entries);
  return {
    manifestVersion: 4,
    sourceCommit,
    fileCount: entries.length,
    sourceRoots,
    explicitFiles: sourceFiles,
    files: checksums,
    checksum: sha256(entries.map(([file, checksum]) => `${file}:${checksum}`).join("\n"))
  };
}

export async function createPreflightSnapshot({ observedAt, sourceCommit }) {
  await assertInputs({ observedAt, sourceCommit });
  return {
    productionProjectRef,
    observedAt,
    sourceBaselineCommit: sourceCommit,
    sourceStateProvenance: "the complete source manifest is verified byte-for-byte against the recorded Git commit; no Git deployment is required",
    ownerUserId,
    hostedState: {
      ownerUserExists: true,
      activePersonalWorkspaceResolvedByMembership: 1,
      workspaceSchemaExists: true,
      workspacePrivateSchemaExists: true,
      dataApiSchemas: "public,workspace",
      workspacePrivateExposed: false,
      workspacePrivateBucketIsPrivate: true,
      workspacePrivateStorageObjects: 0,
      targetCounts: {
        tasks: 0,
        captureInbox: 0,
        jobApplications: 0,
        memoryEntries: 0,
        aiConversations: 18,
        dailyBriefings: 1,
        integrationConnections: 7,
        files: 0,
        gateBImportLedger: 26
      },
      integrationRedactionOk: true
    },
    vercelState: {
      team: vercelTeam,
      projectName: vercelProjectName,
      projectId: vercelProjectId,
      projectExists: true,
      deploymentState: "an existing protected Gate C deployment is present; this remediation package does not alter it during preparation",
      lockedSourceFramework: "nextjs",
      deploymentProtection: "prod_deployment_urls_and_all_previews",
      productionEnvironmentVariableNames: [
        "NEXT_PUBLIC_APP_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_WORKSPACE_SCHEMA",
        "NEXT_PUBLIC_WORKSPACE_UPLOADS_ENABLED"
      ]
    },
    supabaseAuthState: {
      siteUrl: "https://www.leademergence.com",
      signupSetting: "unchanged from the pre-Gate-C baseline",
      redirectUrlCount: 13,
      originalRedirectUrlCount: 11,
      workspaceRedirectUrlsAppended: [`${productionUrl}/login`, `${productionUrl}/workspace`]
    }
  };
}

export function configuration() {
  return {
    project: {
      team: vercelTeam,
      name: vercelProjectName,
      sourceRepository: "https://github.com/abostwick12/lead-emergence-workspace.git",
      framework: "nextjs",
      rootDirectory: ".",
      installCommand: "npm ci",
      buildCommand: "npm run build",
      productionUrl,
      deploymentProtection: "Vercel Authentication",
      productionOnly: true
    },
    environmentVariables: [
      { name: "NEXT_PUBLIC_SUPABASE_URL", target: ["production"], value: `https://${productionProjectRef}.supabase.co`, visibility: "public configuration" },
      { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", target: ["production"], value: "current enabled publishable key for the shared production project", visibility: "public configuration" },
      { name: "NEXT_PUBLIC_WORKSPACE_SCHEMA", target: ["production"], value: "workspace", visibility: "public configuration" },
      { name: "NEXT_PUBLIC_APP_URL", target: ["production"], value: productionUrl, visibility: "public configuration" },
      { name: "NEXT_PUBLIC_WORKSPACE_UPLOADS_ENABLED", target: ["production"], value: "false", visibility: "public feature gate" }
    ],
    forbiddenEnvironmentVariables: [
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SECRET_KEY",
      "WORKSPACE_INTEGRATION_ENCRYPTION_KEY",
      "GOOGLE_CLIENT_SECRET",
      "OAUTH_CLIENT_SECRET",
      "OPENAI_API_KEY"
    ],
    supabaseAuth: {
      sharedProjectSafeguard: "Do not change the shared Auth Site URL or signup setting; both can affect the Ministry application.",
      additionalRedirectUrlsToAppendOnly: [`${productionUrl}/login`, `${productionUrl}/workspace`],
      preserveExistingRedirectUrls: true,
      preserveOrder: true,
      noWildcardRedirects: true
    },
    storage: {
      uploadsEnabled: false,
      noStorageClientCallsInRuntime: true,
      releaseBlocker: "The authenticated owner/non-owner/anonymous Storage API lifecycle test must pass before external users or Workspace uploads are enabled."
    }
  };
}

export function acceptanceSuite() {
  return [
    { id: "deployment-protection", expected: "Vercel Authentication protects the production URL before application authentication." },
    { id: "authentication", expected: "The approved existing account signs in; unauthenticated /workspace visits return to /login." },
    { id: "session", expected: "Refresh preserves the authenticated session; sign-out clears it and returns to /login." },
    { id: "workspace-resolution", expected: "Client resolves exactly one active personal owner membership without hard-coded Workspace ID or writes." },
    { id: "migrated-data", expected: "RLS-scoped reads return 18 conversations, one briefing, seven reconnect_required/redacted integrations, and their approved values." },
    { id: "empty-domains", expected: "Tasks, capture, career, memory, and files render empty states; no Workspace Storage objects exist." },
    { id: "authenticated-crud-and-audit", expected: "Transactional owner-claim harness creates, updates, and deletes a synthetic task through RLS, observes audit events, and rolls back." },
    { id: "cross-product-isolation", expected: "The approved cross-product hostile suite passes under rolled-back synthetic authenticated and anonymous claims." },
    { id: "uploads-disabled", expected: "No upload UI or runtime Storage call exists and NEXT_PUBLIC_WORKSPACE_UPLOADS_ENABLED is false." },
    { id: "secret-and-log-inspection", expected: "Source/build/runtime logs contain no service-role key, OAuth/API token, integration configuration, conversation content, or unexpected runtime error." }
  ];
}

export function rollbackProcedure() {
  return {
    automaticRollback: false,
    scope: "Vercel deployment only; never delete, alter, or roll back Workspace or Ministry data.",
    steps: [
      "Stop acceptance immediately on a failed production check and preserve Vercel/Supabase evidence.",
      "If an earlier known-good Vercel production deployment exists, explicitly promote or roll back to it after approval.",
      "If this is the first deployment, disable production access with Vercel Deployment Protection rather than deleting the project or changing the shared Supabase configuration.",
      "Do not modify Workspace data, source command-center records, Auth users, Storage policies, integrations, routing, or Consulting OS."
    ]
  };
}

export function runbook(snapshot, bundle) {
  const config = configuration();
  if (bundle.sourceCommit) {
    return [
      "# Gate C — Private Workspace remediation deployment runbook",
      "",
      "This package is preparation only. It must not run until separate remediation-deployment approval.",
      "",
      "## Preconditions",
      "",
      `- Verify the complete source bundle checksum: \`${bundle.checksum}\` across all ${bundle.fileCount} locked files and confirm it is byte-for-byte equivalent to Git commit \`${bundle.sourceCommit}\`.`,
      "- Materialize only the files in `gate-c-source-bundle.json`, run `npm ci`, and require `npm run build` to pass before any upload.",
      "- Re-run the hosted membership-based preflight; it must match `gate-c-preflight.json`.",
      `- Vercel project \`${vercelProjectId}\` must exist in \`${config.project.team.slug}\` with the existing protected Gate C deployment intact.`,
      "- Vercel Authentication must remain enabled for production URLs and all previews.",
      "- Exactly the five approved Production environment-variable names must remain configured; no Preview variables may be added.",
      "- The shared Supabase Site URL and signup setting must remain unchanged, and the two Workspace redirect URLs must remain appended after the original 11 entries.",
      `- Use the exact production hostname \`${productionHostname}\`; stop rather than substituting a different hostname.`,
      "",
      "## Approved execution after separate approval",
      "",
      "1. Do not recreate the existing Vercel project or change its team, domain, deployment protection, environment variables, or Supabase Auth configuration.",
      "2. Materialize an isolated directory from the locked source manifest and add only Vercel's local `.vercel` link metadata, which is control metadata rather than application source.",
      "3. Use the locked `vercel.json` to select Next.js with `npm ci` and `npm run build`, then deploy only the verified remediation bundle to Production.",
      "4. The direct CLI deployment must use only the recorded Git commit and its verified source manifest. If the workflow changes to Git deployment, retain the same commit and stop for a new provenance review.",
      "",
      "## Post-deployment acceptance",
      "",
      "Run every case in `gate-c-acceptance.json`. Use the existing owner account only through ephemeral operator credentials; do not save those credentials, session tokens, conversation content, or integration details. The CRUD/audit and cross-product checks use rolled-back transactional synthetic fixtures.",
      "",
      "## Rollback",
      "",
      ...rollbackProcedure().steps.map((step, index) => `${index + 1}. ${step}`),
      ""
    ].join("\\n");
  }
  return `# Gate C — Private Workspace deployment runbook\n\nThis corrected package is preparation only. It must not run until separate Gate C execution approval.\n\n## Preconditions\n\n- Verify the complete source bundle checksum: \`${bundle.checksum}\` across all ${bundle.fileCount} locked files.\n- Materialize only the files in \`gate-c-source-bundle.json\`, run \`npm ci\`, and require \`npm run build\` to pass before any upload.\n- Re-run the hosted membership-based preflight; it must match \`gate-c-preflight.json\`.\n- Vercel project \`${vercelProjectId}\` must exist in \`${config.project.team.slug}\` with zero deployments.\n- Vercel Authentication must remain enabled for production URLs and all previews.\n- Exactly the five approved Production environment-variable names must remain configured; no Preview variables may be added.\n- The shared Supabase Site URL and signup setting must remain unchanged, and the two Workspace redirect URLs must remain appended after the original 11 entries.\n- Use the exact production hostname \`${productionHostname}\`; stop rather than substituting a different hostname.\n\n## Approved execution after separate approval\n\n1. Do not recreate the existing Vercel project or change its team, domain, deployment protection, environment variables, or Supabase Auth configuration.\n2. Materialize an isolated directory from the 30-file lock and add only Vercel's local \`.vercel\` link metadata, which is control metadata rather than application source.\n3. Use the locked \`vercel.json\` to select Next.js with \`npm ci\` and \`npm run build\`, then deploy only the verified bundle to Production.\n4. Do not require a Git commit or push for the direct CLI deployment path. If the workflow changes to Git deployment, stop for a new provenance review.\n\n## Post-deployment acceptance\n\nRun every case in \`gate-c-acceptance.json\`. Use the existing owner account only through ephemeral operator credentials; do not save those credentials, session tokens, conversation content, or integration details. The CRUD/audit and cross-product checks use rolled-back transactional synthetic fixtures.\n\n## Rollback\n\n${rollbackProcedure().steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n`;
}

export async function buildPackage({ observedAt, sourceCommit, packagingToolChecksums }) {
  const snapshot = await createPreflightSnapshot({ observedAt, sourceCommit });
  const bundle = await sourceBundle(sourceCommit);
  const config = `${JSON.stringify(configuration(), null, 2)}\n`;
  const preflight = `${JSON.stringify(snapshot, null, 2)}\n`;
  const source = `${JSON.stringify(bundle, null, 2)}\n`;
  const acceptance = `${JSON.stringify(acceptanceSuite(), null, 2)}\n`;
  const rollback = `${JSON.stringify(rollbackProcedure(), null, 2)}\n`;
  const instructions = runbook(snapshot, bundle);
  const checksums = {
    configuration: sha256(config),
    preflight: sha256(preflight),
    sourceBundle: sha256(source),
    acceptance: sha256(acceptance),
    rollback: sha256(rollback),
    runbook: sha256(instructions),
    packagingTools: packagingToolChecksums
  };
  const manifest = `${JSON.stringify({
    package: "gate-c-private-production-remediation-deployment-v3",
    productionProjectRef,
    sourceBaselineCommit: sourceCommit,
    sourceStateProvenance: "the complete source manifest is verified byte-for-byte against the recorded Git commit; no Git deployment is required",
    sourceBundleChecksum: bundle.checksum,
    configuration: { team: vercelTeam, project: vercelProjectName, productionUrl },
    checksums,
    executionScope: "corrected preparation only; no deployment, no route change, no source-data mutation, no integration reconnect, no Storage enablement"
  }, null, 2)}\n`;
  return {
    "gate-c-configuration.json": config,
    "gate-c-preflight.json": preflight,
    "gate-c-source-bundle.json": source,
    "gate-c-acceptance.json": acceptance,
    "gate-c-rollback.json": rollback,
    "gate-c-runbook.md": instructions,
    "manifest.json": manifest,
    packageChecksum: sha256(`${manifest}${config}${preflight}${source}${acceptance}${rollback}${instructions}`),
    checksums
  };
}
