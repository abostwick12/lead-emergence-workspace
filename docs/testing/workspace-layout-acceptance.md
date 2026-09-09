# P10 — User-owned Workspace Experience layout

Date: 2026-09-09. Status: native implementation and optimized
browser acceptance verified. **All six bundles remain NOT READY TO SHIP.**

## Milestone and architecture

Workspace Experience is now the sixth ordinary assignable bundle. Migration
32 registers only its implemented composition and personalization capabilities.
Assignments use the existing operator configuration; no client-specific code,
implicit personal-plan grant, deployment or provider account is needed.

The reusable source owns Layout Schema 1.0 and deterministic presentation.
Workspace imports an explicit pinned export and remains the sole authority
for identity, entitlement, native preferences, history and confirmation.
Bundle Contract and UI Manifest Contract remain 1.0. Workspace Experience
manifest version is 0.2.0; the other bundle implementations are unchanged.

Native preferences are composed only after the host's capability filtering.
The authority revision remains independent of the layout revision, so a
layout save cannot remount a domain editor. MCP tool composition continues
using the base authority resolver and does not depend on native preferences.

## Implemented user experience

- Pin, show/hide and order assigned navigation and Home attention cards.
- Choose a starting workspace for sign-in without a specific destination.
  Explicit Home and deep links retain their normal destinations.
- Inspect a full preview and separately confirm before saving.
- Reload a saved layout, load a previous version as an unsaved draft, or
  restore defaults as a draft. The latest 20 versions are exposed for recovery.
- Detect stale tabs and changed entitlement snapshots, retain the local draft,
  and require reload/review instead of overwriting newer saved choices.
- Retry an identical save request without a duplicate version.
- Retain dormant saved choices across access revocation. Unavailable routes
  fall back to Home; regrant can restore the user's retained preference.
- Reach Home, Settings and layout recovery even after hiding every bundle.
- Keep hidden work authorized and intact: hiding is not deletion, revocation,
  notification suppression or cross-domain sharing.
- Distinguish an unavailable preference read from an empty layout. Preserve
  verified capabilities and editor authority, but withhold unverified
  navigation/cards and offer a clear retry.

The skill-creation guidance informed the updated Workspace Designer skill:
recommendations are advisory, native preview/confirmation is required, and
no model-accessible layout persistence tool is claimed or implemented.

## Persistence and security

Private current-state, immutable-version and registered-contribution tables
have RLS and no direct authenticated/anonymous table grants. Narrow,
security-definer RPCs derive the owner workspace from the verified native
session and current Workspace Experience capability.

The SQL boundary independently validates strict keys, identity grammar,
duplicates, list/object/string sizes, integer ordering, correct pin kind,
pin/hide contradictions, known implemented contributions, current domain
capability and admitted default route. The HTTP boundary also bounds streamed
request size and rejects unconfirmed or malformed bodies.

Saves serialize per workspace with expected preference and authority revisions.
Exact retries must retain the same body, base revision, authority revision and
current request result. Stale, changed and superseded retries cannot roll back
a later save. Recovery creates another explicitly confirmed revision.

OAuth-connected clients are denied native layout reads and writes, both via
actual HTTP and direct RPC. No service-role credential enters the app runtime.
No private domain bodies are copied into layout preferences.

## Verification ledger

- Source: typecheck and **120 tests in 12 files**; all six plugins and six
  skills validate.
- Host: typecheck, lint, **290 unit tests in 30 files**, **32 schema checks**
  and **256 runtime boundary checks** pass.
- Optimized build: passes with **53 static pages**, including the new layout
  and starting-workspace pages and a native dynamic layout API.
- Existing isolated database restored without reset; migration 32 applied to
  its retained 31-migration baseline. **628 PostgreSQL assertions in 19
  rollback-only suites** pass. This is upgrade proof, not fresh replay of 32.
- **12 real native HTTP/authenticated RPC acceptance groups** pass: confirmed
  persistence, owner isolation, all-six configuration, catalog parity, malformed
  data, no authority changes, exact retries, concurrent saves, revoked/dormant
  choices, regrant, native-only claims and recovery history.
- **3 actual local OAuth/PKCE/MCP groups** pass for the all-six fixture:
  existing domain tools compose without a layout write tool; OAuth credentials
  cannot read/write native preferences through RPC or HTTP; the saved revision
  stays unchanged and the test grant is disconnected.
- **13 Executive native HTTP/actual OAuth-MCP regression groups** pass.
- Development preview: all **12 desktop/mobile layout journeys** passed twice,
  including interruption, recovery, stale tabs, default versus explicit sign-in,
  unassigned/Experience-only states and an open editor's unsaved draft.
- Final optimized all-bundle browser run: **130/130 pass in 8.6 minutes**,
  desktop and mobile, ten spec files, zero retries. This includes 14 layout
  journeys with ordering and actual server-committed/lost-response recovery.
  A subsequent two-viewport focused run additionally verifies the refreshed
  sidebar excludes hidden links and retains confirmed ordering before capturing
  proof. No runtime code changed after the 130-case run.
- **31 transformed source exports and SHA-256 hashes** match source commit
  ad6c41da1d3b822b459ebb27e55113cc3e10ee80. Narrow changed-source credential
  scan passes across 47 changed files; this is not a complete privacy,
  vulnerability or history audit.

### Corrected and interrupted attempts

The first migration attempt exposed a PL/pgSQL CASE-expression delimiter;
the corrected migration applied without reset. An initial fixture-revocation
test omitted the required revocation reason; the corrected script passed with
fixture-only restoration in finally. The sign-in static test was updated to
verify the new entry helper still delegates to the safe path normalizer.

Initial browser selectors used exact label matching on a nested select and an
ambiguous alert matching the framework's route announcer. Role-based control
selectors and message-scoped alerts fixed the tests without weakening their
behavior checks. The corrected development runs passed.

Repeated retained fixtures exposed a legacy Executive test assumption that
new records must occur in the first 50 attention items. The test now validates
the legacy bound and uses real paginated attention to locate the exact records
and tasks, retaining private-canary and cross-client checks. The full connected
regression then passed.

An initial optimized regression was deliberately stopped after 25 successful
journeys to include a truthful ambiguous-save error message and an additional
server-committed/lost-response recovery case in the final build. No failed
assertion was waived or turned into a skip.

## Integration, platform and external configuration

Uses existing Workspace shell, settings, domain attention widgets, return-path
normalizer, authenticated session, operator assignment and local Supabase.
Search/automation metadata remains capability-gated and unimplemented
Experience capabilities are not registered as available runtime features.

No new OpenAI platform API, plugin structure, installed-host behavior or
provider integration is asserted by this milestone. Existing plugin/skill
validators and actual local OAuth/MCP boundaries were exercised. This is not
installed ChatGPT/Codex acceptance or production sign-in/provider proof.

Only the named bundle-experience-p2 stack and loopback preview were used.
Three new fictional accounts bring its fixture total to 19 (zero non-fictional
users), confirmed by aggregate database inspection. This turn leaves zero new
active OAuth grants; the four pre-existing grants were not changed. Final
Executive source/task sharing counts are both zero. The loopback preview is
closed and the isolated stack stopped with backups retained. No client data,
paid infrastructure, hosted migrations, production deployment, main merge,
repository visibility change or marketplace submission is authorized by this
checkpoint. Existing unrelated stacks and accounts were left untouched.

## Remaining shipment gates and next step

Shared scoped search, useful quick-action/command consumers, a connection and
notification experience, and grounded AI layout proposals remain unfinished.
Recurring lifecycle, rich ingestion, domain crash recovery and grouped
attention also remain open where documented in the six-bundle readiness map.

Representative source-quality and unaided user-value evaluation, fresh
32-migration replay, approved non-production/installed-host acceptance,
deployed recovery/privacy/retention/operations, commercial enforcement and
the final client shipment decision remain required.

Next: implement cross-bundle scoped search and actionable navigation/commands
using the same admitted capabilities and privacy boundaries. Do not replace
these gates with manifest validation or synthetic timing claims.
