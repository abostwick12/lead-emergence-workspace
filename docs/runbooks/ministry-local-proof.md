# Ministry isolated acceptance

Use only .bundle-local project bundle-experience-p2 on ports 58420–58427.
No hosted link, migration push/repair, production deployment or client data.

1. Prepare with node scripts/prepare-bundle-local.mjs.
2. Start the exact isolated project and capture startup output privately; the
   CLI can print local keys. Check its project ID and API port before resetting.
3. Replay all 24 migrations locally, replacing only fictional test data.
4. Run node scripts/seed-writer-local.mjs followed by
   node scripts/seed-ministry-local.mjs. These produce private local fixtures:
   Writer, Reader, other Writer, operator, Minister, other Minister and dual.
5. Run node scripts/serve-writer-local.mjs dev. The runner passes only public
   configuration to the app, bound to loopback port 3125.
6. Run node scripts/test-ministry-local.mjs. It verifies ten real database,
   native-API and OAuth/MCP groups; it removes only its exact created document
   IDs, restores a pre-existing fictional profile, and restores the capability
   mapping it temporarily disables.
7. Include supabase/tests/database/ministry_native_workspace.sql in the local
   database regression suite. Eighteen new assertions protect private tables,
   RLS and helper/anonymous privileges; the full local suite has 330 assertions.
8. Set E2E_BASE_URL=http://localhost:3125 and MINISTRY_LOCAL_ACCEPTANCE=true,
   then run tests/e2e/ministry-connected.spec.ts in desktop and mobile Chrome.
   Ten cases cover four native workflows plus consent disclosure in each view.
   Successful actions use the actual local backend. Only save-failure paths
   are deliberately injected. Downloaded files are read and asserted.
9. For optimized native acceptance, stop only this preview, build/start through
   the same guarded runner, and rerun the native browser cases. MCP must stay
   in dev-mode loopback acceptance because the optimized canonical-host guard
   intentionally denies local MCP with 421. Do not weaken that guard.

Never run lifecycle scripts concurrently with browser tests: capability changes
and profile restoration are deliberately visible. Browser fixtures and traces
remain private; traces may contain fictional credentials. Only inspected,
synthetic success screenshots may enter published evidence. Stop only the
owned preview and isolated stack after testing, preserving its volume.
