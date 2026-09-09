# Investor isolated acceptance

Use only project bundle-experience-p2 in .bundle-local, API 58421, database 58422
and loopback preview 3125. Never link/push/repair hosted migrations or use client
information. Capture local startup credentials privately, not in terminal logs.

1. Run prepare-bundle-local.mjs, verify the exact project ID and ports, then
   start/reset only this isolated stack. Replay the twenty-six migration chain.
2. Seed Writer, Ministry, Nonprofit and Investor in that order with their
   seed-*-local.mjs scripts. Investor adds fictional Investor, other-client and
   four-bundle users. Credentials stay in the ignored .bundle-local directory.
3. Start serve-writer-local.mjs dev. It passes only public local configuration
   into the app and removes service-role/secret environment variables.
4. Run test-investor-local.mjs. Its eleven groups exercise actual RPC, HTTP,
   local OAuth consent/PKCE and fourteen MCP tools. It uses no live SEC read.
   Cleanup removes only the suite's exact created records and its budget row;
   capability mappings temporarily disabled for testing are restored.
5. Run test-bundle-rls-local.mjs for thirteen transactional local SQL suites.
   It initializes only the local pgTAP testing extension and avoids a Windows
   path-with-spaces issue in the Supabase CLI. The hosted Gate A preflight is
   intentionally excluded because this isolated database has no legacy tables.
6. Run existing Nonprofit, Ministry and all four Writer connected scripts
   sequentially. Do not overlap lifecycle tests with browser acceptance.
7. Browser acceptance uses INVESTOR_LOCAL_ACCEPTANCE=true,
   E2E_BASE_URL=http://localhost:3125 and tests/e2e/investor-connected.spec.ts.
   Seven workflows run on desktop and mobile-emulated Chrome with one worker
   and no retries. Saves, decisions, history and downloads use the actual local
   database. The explicit failure path and clearly named public-metadata UI
   fixture are injected; they do not prove live upstream access.
8. Stop only the owned preview. Run the normal build, then the guarded isolated
   build last, and start the optimized app using the guarded runner. Repeat all
   Investor, Writer, Ministry and Nonprofit browser suites. Keep the optimized
   MCP canonical-host guard intact; protocol tests use the guarded development
   environment, not a weakened production origin rule.
9. Inspect successful synthetic screenshots. Publish only inspected UI proof;
   traces, videos and fixture files can contain local credentials and must stay
   ignored. Stop only this preview and isolated stack, preserving local backup.

A single live public SEC read was declined with 403. The app exposed the honest
unavailable state, made no research finding and did not retry. Record any future
operator-approved integration verification separately from fixture-based tests.

Authoritative outcomes belong in docs/testing/test-evidence.md. Local acceptance
is not installed-host, deployed recovery, source-quality or representative-client
value acceptance. All-six readiness remains NOT READY TO SHIP.
