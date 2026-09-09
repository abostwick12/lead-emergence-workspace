# Reproduce the isolated Writer proof

This runbook uses fictional data only. It does not link to a hosted project,
apply a hosted migration, install a plugin, or change production.

Prerequisites: repository Node version, npm dependencies, Docker, Supabase CLI,
and installed Chrome for Playwright. On Windows, ensure Docker's executable
directory is on PATH. Do not reset existing local stacks.

## Prepare and run

From the Workspace checkout:

```powershell
npm ci
npm run prepare:writer:local
supabase start --workdir .bundle-local
npm run seed:writer:local
npm run dev:writer:local
```

The preparation script uses project ID `bundle-experience-p2`, API port 58421,
and distinct database/studio ports. The fixture and server scripts verify that
exact local configuration. Stop if those ports are already owned by something
else. Seed once for a fresh stack; repeat seeding creates new fictional users.

In a second terminal:

```powershell
npm run test:writer:local
$env:WRITER_LOCAL_ACCEPTANCE = 'true'
$env:E2E_BASE_URL = 'http://localhost:3125'
npx playwright test tests/e2e/writer-connected.spec.ts --workers=1
```

Keep one browser-test worker because lifecycle tests revoke and restore the same
synthetic grant. Do not run the API lifecycle test concurrently with browser
acceptance. Both restore the fictional Writer entitlement in cleanup.

Generated `.bundle-local/fixtures.json` contains local test credentials.
`.bundle-local`, browser traces, screenshots, and test reports are ignored.
Do not commit or send fixture files, traces, tokens, or the local status output.
The test-only public configuration contains no elevated credential.
The dev server receives public configuration only; the seed helper alone uses
a local administrative credential to create fictional accounts.

The API test writes a credential-free `.bundle-local/api-evidence.json`.
Successful browser screenshots are saved under `test-results/writer-*.png`.
Inspect desktop and mobile screenshots, not only assertion counts.
For a source checkpoint, rerun all checks listed in AGENTS.md.

## What these tests actually verify

- Fresh migration replay and thirty-three PostgreSQL denial/authority assertions.
- P4 additionally verifies direct-session-only drafts and bounded discovery.
- Real local user sessions and web read endpoints.
- Real local OAuth dynamic registration, approval, grant activation and PKCE.
- Real MCP HTTP tool discovery and resource parity with web data.
- Wrong-tenant reads, missing access, revoked grants and disconnected OAuth.
- Desktop/mobile navigation, attention counts, search/filter, source review,
  copy notes, clear-on-revocation, and retry after injected authority failure.

They do not verify installed ChatGPT/Codex plugins, hosted Entry handoff, a
deployed consent UI, Wix, physical devices, production performance, or user ROI.

## Stop safely

Stop the Writer dev terminal, then:

```powershell
supabase stop --workdir .bundle-local
```

Do not add `--no-backup`; preserving the local volume keeps fictional fixtures
available. Do not use `--all`, reset the default stack, or target any other
project's containers. Starting this same stack later allows the local fixture
files to be reused.

## P3 revision acceptance and optimized browser mode

The same isolated stack now includes native Writer revisions. Prepare migrations
before a fresh reset; resetting this local project destroys only its synthetic
fixture database, so seed again afterward. Never reset another project.

Run npm run test:writer:revisions with the preview running to exercise real
native import, proposal and approval, retries, concurrency and original retention.
It deletes only the exact synthetic resources it creates.

For browser acceptance without development compilation, stop the dev preview,
run node scripts/serve-writer-local.mjs build, then
node scripts/serve-writer-local.mjs start in its own terminal. Both modes use
only the isolated public Supabase configuration; the app listens on loopback.

Set WRITER_LOCAL_ACCEPTANCE=true and E2E_BASE_URL=http://localhost:3125,
then run npx playwright test tests/e2e/writer-connected.spec.ts
tests/e2e/writer-revisions-connected.spec.ts. Do not run revocation suites
concurrently against the same fixture entitlement.

MCP tests must use development mode on loopback. The optimized server enforces
the existing canonical-host requirement and intentionally rejects local MCP
with 421; do not disable production protection to accommodate this test setup.
Stop the optimized preview, start npm run dev:writer:local, then run
npm run test:writer:local. The latter performs a real local authorization-code
flow but does not test the hosted consent page or installed AI host.

P3 checks add two PostgreSQL denial assertions (35 total) and actual assistant
proposal/approval separation. The browser revision flow uses fictional content
and a deliberately injected failed-save response to verify retry behavior.

## P4 recovery and discovery acceptance

Prepare and cleanly replay the 22 migrations on only bundle-experience-p2, then
recreate fictional fixtures. With the app preview running, run
`npm run test:writer:library` for seven real database/native-API test groups.
It removes only its own exact synthetic resource IDs and restores the review
capability it temporarily disables. Do not run it concurrently with browser
tests or other entitlement lifecycle tests.

`npm run test:writer:local` now has nine groups, including actual OAuth discovery
parity and draft read/save/discard denial via direct RPC. Use dev mode for this
MCP suite; the optimized loopback host remains intentionally disallowed for MCP.

In optimized native-browser mode, include
`tests/e2e/writer-library-connected.spec.ts` alongside the two existing Writer
files. The full suite has 16 tests across desktop and mobile-emulated Chrome.
New cases cover failed autosave, reload recovery, lost successful import
responses without duplicate imports, two-tab conflicts, explicit stale-base
comparison, full-text search and approval-backed related-resource metadata.
The existing revocation case now checks that working-draft text also disappears.

## P5 confirmed preferences and publication preparation

The isolated stack now replays 23 migrations. Run
`npm run test:writer:preparation` against the preview for six actual profile and
publication groups. The script restores the fictional users' original active
profiles (as a new confirmation revision), restores a temporarily disabled
profile capability, and removes only its own exact synthetic resource IDs.
Do not run lifecycle tests concurrently.

`npm run test:writer:local` now has eleven groups. New real OAuth checks compare
confirmed profile/publication output with native output, deny assistant profile
confirmation and private history via direct RPC, and recheck revoked access.

Include `tests/e2e/writer-preparation-connected.spec.ts` in optimized acceptance
alongside all three earlier Writer files. New flows test explicit confirmation,
failed/lost save responses, earlier-profile review, two-tab conflicts, revocation,
taxonomy proposals before approval, real TXT/JSON downloads and stale exports.
Browser fixtures remain synthetic; successful exports are read and asserted by
the test runner, not mocked. Failure traces can contain test credentials: inspect
only needed error details locally and never publish traces or fixture files.

The Supabase CLI may print local keys when starting or showing stack status.
Keep that output private; never paste it into evidence or publication logs.
