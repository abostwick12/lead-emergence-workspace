# P13 — native connection evidence and privacy controls

Milestone: P13. Repository: abostwick12/lead-emergence-workspace.
Branch: codex2/bundle-experience-integration. Parent: ec61dd4f18d911d5c3ff0527755449af84eb9557.
Portable source: abostwick12/lead-emergence-bundles, codex2/bundle-platform-v1,
107e106661bf7f3b90e0e69a65333900bb26bca0. Export: 34 allowlisted files.
Overall client shipment remains NOT READY. See the release checklist in the portable source.

## Architecture and user experience

The existing Connections route now uses a native owner-bound center instead
of translating saved labels into connected status. It reports:

- Every owned assistant metadata record and Workspace resource grant, including
  consent with no registration. Complete counts are separate from pages of 25.
- Current Workspace grant, registration, client-deletion, admission and plan
  evidence. This is not a live token test, verified provider identity, successful
  tool execution or installed-plugin acceptance.
- Saved external credential families, missing/recorded/expired/revoked state,
  shared consumers, recorded timestamps and independent release availability.
  Stored credentials and historical activity never imply live provider success.
- Optional provider/app requirements from currently composed bundle manifests.
  Wix, Logos and Finances remain planned. Public-source workflows do not need
  a connected account. Native bundle work remains independent of these options.

Account/workspace changes remount the view. Refresh, errors and leaving the
visible page clear previous status. Aborted or late reads cannot repopulate it.
Failed disconnect responses retain the same reviewed request for a safe retry.
Settings delegates assistant access to this same center and no longer reads raw
connection labels or offers a separate unversioned disconnect button.
The assistant setup page no longer writes when opened and only reports clipboard
success after the copy operation succeeds.

## Confirmation and safety

GET /api/bundles/connections accepts only a canonical bounded offset.
POST accepts an exact kind, opaque ID, revision fingerprint, request UUID and
explicit confirmation. Both are bearer-verified, private/no-store and schema
validated. The database independently derives the native personal owner and
rejects OAuth client sessions. It does not require a paid plan or bundle
entitlement to inspect or revoke one's own saved access.

Private row projections never expose client IDs, credential ciphertext, raw
OAuth responses, account-subject hashes or refresh tokens. The metadata helper
and retry receipts are private and unavailable to authenticated callers.
The center adds no model tool and grants no cross-bundle source-sharing access.

A reviewed assistant disconnect revokes only the selected Workspace resource
grant and disables its registration. A reviewed external disconnect removes the
credential family and pending setup attempts, and marks all matching family
records disconnected. Google affects Gmail, Calendar and Drive. Other families,
other owners and saved bundle records are unchanged.

An exact receipt is returned before any repeat mutation. Reusing a request UUID
with a different review fails. Concurrent consent activation and native
revocation share a user-bound advisory lock, including a new grant with no
existing row to lock. Existing grant/metadata/vault rows are locked before
fingerprint comparison. External changes also share the existing workspace
advisory lock. These are short database transactions, not browser-held locks.

Normal assistant request timestamps and recorded provider activity do not stale
a review. New consent, scopes, registration-state changes and credential
replacement still invalidate it. This keeps active assistants disconnectable.

Provider/assistant-side authorization is separate. This center does not delete
Auth client catalogs or claim to revoke third-party grants. The user is told to
manage those in the provider's account settings. Credential removal cannot
restore a removed token; reconnect requires fresh explicit consent.

## Files and integration

Portable: bundles/workspace-experience/connections.ts and contract tests.
Host: the Connections, Settings and assistant-setup routes, ConnectionCenter component and
styles, native API, manifest guidance adapter and three migrations:
20260913120000_workspace_connection_center.sql and
20260913123000_connection_consent_serialization.sql, plus
20260913130000_connection_review_evidence.sql.

Acceptance includes rollback SQL, actual local OAuth/PKCE/MCP and desktop/mobile
browser tests. Detailed results are in ../testing/workspace-connections-acceptance.md.
No hosted migration, main merge, provider release, client account connection,
new billing infrastructure or plugin submission occurred.

## OpenAI guidance applied

Official authentication guidance requires runtime grant/scope enforcement; saved
metadata is not authority. This motivated independent grant and registration
evidence and revocation checks. [Authentication guidance](https://developers.openai.com/plugins/build/auth),
checked 2026-09-09.

Official connection guidance distinguishes local MCP tests from complete installed
plugin tests. The setup page reflects the current Developer Mode/Plugins flow
and preserves installed-host testing as a separate release gate.
[Connection and testing guide](https://developers.openai.com/plugins/deploy/connect-chatgpt),
checked 2026-09-09.

## Remaining work and next step

Build a native notification center from authoritative saved-work and connection
events, with durable read/dismiss/preferences and honest delivery limits.
Grounded, approval-only layout proposals, autosave/crash recovery, richer ingestion,
representative information-quality/value trials, installed-host behavior and
approved deployed release/rollback tests remain open across the six bundles.
No synthetic timing or local OAuth test substitutes for those gates.
