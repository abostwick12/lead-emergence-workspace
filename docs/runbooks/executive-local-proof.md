# Executive local proof

Use only isolated project bundle-experience-p2 and fictional example.invalid
accounts. No hosted migration, client data or provider connection is authorized.
Exact current results and corrected attempts belong in docs/testing/test-evidence.md.

## Environment and sequence

1. Run npm run prepare:writer:local. Verify the copied configuration names
   bundle-experience-p2, API port 58421 and expected 58420–58427 local ports.
   Do not print private status keys or ignored fixture files.
2. Start only the named local stack. Inspect identity counts before mutating
   fixtures. If existing fictional data is retained, preserve it and apply
   pending migrations locally with supabase migration up --local --workdir
   .bundle-local. Never use a linked target, migration repair or reset to bypass
   an environment problem. P9f restored the existing 29-migration database and
   applied 30/31 without a reset: upgrade proof, not a fresh 31-migration replay.
   A separately authorized fresh replay must first verify its exact disposable
   target, preserve backups and exclude non-fictional identities.
3. On an empty authorized stack, seed Writer, Ministry, Nonprofit, Investor and
   Executive in that order. Otherwise reuse the existing fictional fixtures.
   Credentials remain in ignored .bundle-local/fixtures.json. Verify all 31
   applied migrations and that every auth identity is fictional.
4. Run npm run test:executive:local (eight foundation groups),
   npm run test:executive:tasks (seven task groups),
   npm run test:executive:weekly (five recorded-history groups), and
   npm run test:bundles:rls:local (588 assertions in eighteen rollback-only suites).
   Weekly contributes 33 assertions; retained availability contributes 13.
   The hosted-only Gate A preflight is not applicable to this isolated stack.
5. Start node scripts/serve-writer-local.mjs dev on loopback port 3125.
   Run npm run test:executive:connected for thirteen actual HTTP/OAuth/MCP groups.
   The optimized production host guard intentionally rejects localhost MCP
   with 421; never weaken it or forge a host header. The preflight explains this.
   Fictional OAuth grants are disconnected by the suite.
6. Run the Writer local/revisions/library/preparation, Ministry, Nonprofit and
   Investor connected regressions sequentially. Temporary synthetic capability
   changes must not race. Together with Executive these cover 79 groups.
   Investor's suite does not read live SEC or personal accounts.
7. Stop the owned dev preview and verify its port is free. Run boundary, schema,
   type, lint and unit checks, then node scripts/serve-writer-local.mjs build.
   Only public local configuration reaches the app; no admin credentials do.
8. Start node scripts/serve-writer-local.mjs start. Set E2E_BASE_URL to
   http://localhost:3125 and WRITER_LOCAL_ACCEPTANCE, MINISTRY_LOCAL_ACCEPTANCE,
   NONPROFIT_LOCAL_ACCEPTANCE, INVESTOR_LOCAL_ACCEPTANCE and
   EXECUTIVE_LOCAL_ACCEPTANCE to true. Explicitly select these nine specs:
   writer-connected, writer-revisions-connected, writer-library-connected,
   writer-preparation-connected, ministry-connected, nonprofit-connected,
   investor-connected, executive-connected and task-navigation-connected.
   They contain 116 desktop/mobile cases, one worker, zero retries.
   Executive plus task navigation contributes 56 cases: 28 Executive and 28
   exact-task navigation. New weekly cases cover historical/current state,
   preparation, saved zones, paging, empty/error distinction and read retry
   without submitting a confirmed form. New availability cases cover canonical
   persistence, reload, removal and retained original history.
   Test collection is not execution; inspect final outcomes and synthetic images.
9. Check source type/tests, six official plugin/skill validations, all 28 export
   hashes, whitespace and narrow sensitive-data scans before branch publication.
10. Stop only the owned preview and named isolated stack, preserving backups.
    Never use a no-backup option or remove its retained volumes. Do not stop or
    repair the user's Docker backend as part of ordinary test cleanup.

Docker and the installed Supabase CLI must be available. A sandbox access denial
is not proof that Docker is broken; use an authorized read-only engine check.
P9f found Docker already working and performed no repair, restart or reset.
The runtime helper checks project identity and exact loopback URL, privately
reads credentials and addresses only supabase_db_bundle-experience-p2.
CLI telemetry may need normal local sandbox approval.

## Acceptance boundaries

The suites cover strict input, tenant/kind isolation, exact retries, revision
conflicts and original recovery; versioned task consent, fixed six/twelve-field
projections, actual pagination above fifty items; twenty scoped tools, five
assistant proposals and native-only approval/history/permissions; private
canaries, source withdrawal, operator revocation/regrant and disconnection.
Weekly tests distinguish recorded/reported dates, DST windows, corrections and
withdrawals, current access and metadata-only history. Availability tests retain
historical private snapshots, reject invalid nested inputs and omit snapshots
from attention/weekly projections.

For account-free interaction/layout proof, run npm run test:executive:component.
Its bounded runner starts Vite on 127.0.0.1:3130, runs ten desktop/mobile cases and
closes its own server. This harness renders actual meeting components but has
no database, auth or simulated API; in-memory remount is not persistence proof.
It does not replace steps 1–8.

P15 adds private server recovery to all five Executive editors; this runbook's
earlier P9f evidence predates that milestone. No installed host, booking/calendar
provider, notification worker, representative client value or deployed backup,
privacy/retention/commercial acceptance is implied.
All six bundles remain NOT READY TO SHIP until the shared release gates close.
