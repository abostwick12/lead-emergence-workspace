# Executive local foundation proof

P9a tests native database behavior only, not the finished Executive UI or MCP
connection. Use only the isolated bundle-experience-p2 project and its fictional
example.invalid accounts. No hosted migration or client data is authorized.

1. Run `npm run prepare:writer:local` to copy the reviewed migrations into
   `.bundle-local/supabase`. Verify project_id bundle-experience-p2 and API port
   58421 before starting the installed Supabase CLI with that work directory.
2. For fresh replay, first verify all local auth identities are fictional.
   `supabase db reset --local --workdir .bundle-local` replaces only this
   disposable test database. Never use a linked/hosted target.
3. Regenerate fixtures in order with the local Writer, Ministry, Nonprofit,
   Investor and Executive seed scripts. These create only synthetic users,
   native source records and operator-issued local bundle assignments.
   Private fixture credentials stay in ignored .bundle-local/fixtures.json.
4. Run `npm run test:executive:local`. It tests real local sessions and guarded
   database operations, including native source creation across four domains,
   stale/concurrent saves and operator source-entitlement revocation/regrant.
   Source sharing is reset to empty when the final revocation test finishes.
5. Run `npm run test:bundles:rls:local` for all fourteen rolled-back database
   suites. The hosted Gate A preflight is deliberately not applicable.
6. Run the normal Workspace checks and source-repository typecheck/tests plus
   all six official plugin/skill validators. Keep exact source-schema parity
   evidence when adding the Executive export to the host.

Docker must be available to the local runner. It checks project identity and
the exact loopback URL, privately reads local credentials and runs SQL only in
supabase_db_bundle-experience-p2. Never print local status keys or fixture files.

The final P9a run used 27 fresh migrations, seven native RPC groups and
488 database assertions (67 Executive). Source: 64 tests. Workspace: 217 existing
unit tests, 32 schema/policy tests and a 41-page optimized build.

No browser, Executive app HTTP, actual Executive OAuth/MCP invocation, provider,
scheduler, notification, installed host or client-value acceptance is implied.
After testing, stop only this named stack with backup preservation enabled.
