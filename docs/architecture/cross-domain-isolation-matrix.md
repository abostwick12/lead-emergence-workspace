# P18 — cross-domain isolation matrix

Milestone: P18. Host: `abostwick12/lead-emergence-workspace`, branch
`codex2/bundle-experience-integration`, starting HEAD
`955984a639d5142296b2870a8e8b4d2733bf0ad7`. Portable source:
`abostwick12/lead-emergence-bundles`, branch `codex2/bundle-platform-v1`,
pinned source `c9a3207bd7f66e043af4b517ec0095dd58117186`. Overall client
shipment remains **NOT READY TO SHIP**.

## Threat model

A user may legitimately own every bundle. Bundle assignment therefore cannot be
the only reason one domain fails to disclose another domain's private data. A
connected assistant may also hold valid user, client, audience and resource
claims while still lacking native-only or cross-domain authority. Finally,
Executive intentionally supports a narrow, confirmed view of selected source
records, so a blanket “nothing crosses domains” assertion would be false.

The P18 oracle creates two fictional owners, two personal workspaces and all six
entitlements for both owners. The first workspace receives one uniquely searchable
record in each private content domain: Writing, Ministry, Nonprofit, Investor and
Executive. The second receives same-domain control records. All fixtures exist
inside one transaction and are rolled back.

Workspace Experience is not a sixth parallel content store. Its cross-domain
surface is native aggregation. The matrix therefore proves its saved-work search
and attention functions remain unavailable to an OAuth-shaped assistant rather
than inventing a Workspace Experience document type.

## Independent oracle

`supabase/tests/database/cross_domain_isolation_matrix.sql` calls PostgreSQL
functions directly and supplies its own identifiers and expected errors. It does
not reuse a TypeScript adapter, route parser or bundle identifier dispatcher.
That separation prevents an application bug and its test from sharing the same
incorrect routing assumption.

The matrix covers:

- direct `SELECT`, `INSERT`, `UPDATE` and `DELETE` privilege denial for both
  `anon` and `authenticated` on all five private canonical tables, plus RLS;
- anonymous execution denial for all five canonical readers;
- a positive owner control for each reader;
- all 20 off-diagonal ordered identifier pairs through canonical reads and all
  20 again through revision-history functions;
- the five same-domain, other-owner identifiers through the same unavailable
  path, plus positive owner history controls;
- all 25 reader/marker search combinations, requiring exactly one same-domain
  result and zero cross-domain results;
- an authorized OAuth-shaped session with five positive own-domain controls,
  all 20 ordered cross-domain denials, and native aggregate denial;
- immediate denial after OAuth revocation and after each source entitlement is
  revoked.

This complements the existing per-domain save, proposal, confirmation,
idempotency, tenant and direct-table tests. A foreign domain UUID cannot name a
row in another domain's canonical table; the ordered read/history cases prove
that those identifiers remain unavailable instead of being routed or disclosed.

## Executive's explicit exception

Executive starts with no source permission. Before confirmation, all four exact
Writing, Ministry, Nonprofit and Investor references are unavailable. After the
direct user confirms four record capabilities and two supported task capabilities,
Executive can resolve only the fixed metadata projection for those exact records.
Private marker text is absent. Expanded task discovery exists only for Nonprofit
roadmap and Investor thesis; Writer and Ministry task requests are rejected
rather than fabricated.

The same explicit projection is available to an otherwise authorized assistant,
but it does not grant Workspace Experience aggregation. Revoking a source bundle
makes its saved Executive reference unavailable again. The saved permission
never outranks current source authority.

## What this proves—and what it does not

The P18 suite proves implemented database authorization behavior on the retained,
isolated local Supabase stack. It does not prove hosted policy state, installed
ChatGPT/Codex behavior, network-edge configuration, a provider connection, a
representative client's experience, or deployed privacy and recovery operations.
Those release gates remain open.
