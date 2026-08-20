# Test evidence

## Executed locally

- `npm run scan:sensitive` — passed before the first push; full authored working tree scanned (including ignored local files, excluding dependency/build output) and the one preserved private `main` initializer commit scanned. No credential, token, private key, connection string, email address, or application personal-data pattern was found in file content.
- `node scripts/check-workspace-schema.mjs` — passed; SHA-256 `779e78389387e88eede0f3fe7009a9df4a03ffacca86ddd42b740576c581248b` at execution.
- `npm run test:schema` — 4/4 passed.
- `npm run check:boundaries` — passed; no ministry/Consulting imports or service-role runtime client.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run test:unit` — passed; 1/1 unit test.
- `npm run build` — passed.

## Not executed, with reason

- Local Supabase SQL/RLS/Storage hostile tests: Docker and Supabase CLI unavailable.
- Cross-product ministry denial tests: shared-project policy/function/storage metadata not available locally.
- E2E authenticated flows: requires local Supabase fixtures and local stack.
- Production migration/deployment/cutover: intentionally blocked by Gates A–D.

No unavailable test is treated as passing or as approval to onboard external users.
