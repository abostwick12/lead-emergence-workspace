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
