# Bundle client access acceptance

## Acceptance model

This is synthetic, local, source-level acceptance for the generic client-access
workflow. It is evidence that the implementation behaves correctly in the
isolated stack; it is not hosted, production, real-client, payment, support, or
provider proof.

## Required checks

- Freshly replay every migration in `.bundle-local`.
- Run `supabase/tests/database/bundle_operator_lifecycle.sql` and the complete
  repository database suite.
- Run `scripts/test-bundle-pilot-local.mjs` against a production build with
  loopback Supabase and an HTTPS invite origin.
- Run `tests/e2e/bundle-operator-connected.spec.ts` in desktop and mobile Chrome
  emulation.
- Run boundary, schema, type, lint, unit, optimized build, dependency audit,
  and sensitive-data checks.

## Covered behavior

The database suite proves that anonymous and ordinary callers fail closed, a
JWT flag cannot outlive the current Auth record, the private function is not
directly executable, a verified active Personal Workspace owner is required,
all six Lead Emergence bundles appear in the catalog, all six can be granted,
one can be removed and granted again, and the removal history is retained.

The HTTP acceptance proves unscoped and scoped review, owner identity, all-six
assignment, ordinary-user denial, canonical native composition after removal
and re-grant, retry behavior, email-bound invite claim, invite withdrawal, and
hash secrecy.

The browser acceptance proves the operator can complete the reviewed grant,
required-reason removal, re-grant, selectable invite, and invite-withdrawal flow
at both responsive breakpoints. It also checks that the API still requires a
bearer token and that the page does not overflow horizontally.

## Evidence status

The focused database test passes 21 assertions. The production-shaped API flow
passes. The connected browser flow passes two of two cases, one in each
viewport. Final repository-wide counts are recorded in
`docs/testing/test-evidence.md` after the complete release check.
