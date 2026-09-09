# Nonprofit Founder isolated acceptance

Only .bundle-local project bundle-experience-p2, API 58421 and database 58422
are in scope. Never link a hosted project, push/repair hosted migrations, deploy
production or import client information.

1. Prepare the current source with scripts/prepare-bundle-local.mjs, inspect the
   exact project ID/ports and start only this stack. Keep startup keys private.
2. Replay the current twenty-five migration chain from scratch locally. This
   replaces fictional test fixtures only.
3. Run seed-writer-local.mjs, seed-ministry-local.mjs and
   seed-nonprofit-local.mjs in that order. They create fictional, separate-client
   and multi-bundle users; credentials remain in ignored local files.
4. Start scripts/serve-writer-local.mjs dev on loopback port 3125.
5. Run test-nonprofit-local.mjs. It uses actual private-table RPCs, native HTTP,
   loopback OAuth registration/consent/PKCE and all thirteen MCP tools. It cleans
   only its exact created IDs and restores the capability mapping it disables.
6. Include nonprofit_native_workspace.sql with the other local database suites.
   Its twenty-seven rolled-back assertions cover RLS, table privileges and
   anonymous/helper execution. Exclude the hosted-only gate_a_hosted_preflight.sql
   from this isolated stack, which intentionally lacks shared legacy tables.
7. Run the four Writer scripts and test-ministry-local.mjs sequentially to detect
   regressions. Do not overlap lifecycle scripts with browser tests.
8. Browser acceptance uses E2E_BASE_URL=http://localhost:3125,
   NONPROFIT_LOCAL_ACCEPTANCE=true and tests/e2e/nonprofit-connected.spec.ts.
   The six workflows run on desktop/mobile-emulated Chrome with one worker and
   no retries. Only the explicit failure path is injected; saves, approvals,
   history, exports and authorization use the actual backend.
9. Stop only the owned preview. Run the normal build, then the guarded isolated
   build last, and start the optimized app with the guarded runner. Repeat the
   Nonprofit, Ministry and Writer native browser suites. Optimized local MCP
   intentionally fails the canonical-host guard; do not weaken it.
10. Inspect successful screenshots, retaining only synthetic UI proof. Browser
    traces may contain fixture credentials and must never be published. Stop
    only this preview and isolated stack after testing, preserving the volume.

These checks do not prove installed-host, hosted deployment, source research
quality, clinical information detection, representative-client value or provider
integration. See the evidence ledger for outcomes, failures and remaining gates.
