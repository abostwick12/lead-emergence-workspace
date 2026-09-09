# Native saved-work search and quick actions

P11 implementation checkpoint, 2026-09-09. Not a client shipment release.

## User journey

Open **Search saved work**, enter a remembered title, phrase or topic, and search
the visible selected scopes. Scope defaults to all admitted saved-work providers;
the disclosure and expandable checklist show exactly what this means. Exact
titles rank first, then title substrings, then full-text matches, with stable
updated-time/provider/ID tie-breaking. Each card identifies its bundle, record
type, match reason, saved revision and update date, and opens the original.

Search returns at most 25 records per request. It reports counts for every
selected provider, including zero-match providers. Pages reauthorize and read
current records, not a historical snapshot; new saves can alter page order.
Offsets end at 10,000 (10,025 pageable matches). Narrow the query/scope beyond
that boundary. This is lexical search, not semantic retrieval or claim verification.

The shared header's **Quick actions** button and Ctrl/Command+Shift+K open a
keyboard-accessible, locally filtered action palette. Existing Ctrl/Command+K
still opens Quick Capture. Ten implemented shortcuts span all six bundles.
Each opens a chooser, workspace or unsaved editor; it never executes a save,
publication, message, invitation or booking. The manual layout shortcut is not
presented as an AI recommendation. Planned workflows have no fabricated handler.

## Authority and isolation

The portable source owns strict discovery request/result contracts and the
sixteen-provider registry. The Workspace host owns native sessions, authority,
storage, API and concrete navigation handlers. Bundle Contract and UI Manifest
Contract remain 1.0; Workspace Experience manifest is 0.3.0. The source export
is an allowlist with a pinned source revision and SHA-256 hashes.

Migration 33 registers only workspace.search. Catalog and search RPCs derive
the owner workspace from the authenticated direct session, require active
Workspace Experience search access, then require every capability attached to
each selected provider. Unknown, removed or unauthorized scopes fail closed.
Every page supplies the expected current authority revision; changes produce
a conflict rather than a silently reduced result set.

| Saved-work domain | Search scopes | Required native domain access |
| --- | --- | --- |
| Writing | Saved resources | Library AND resource review; no metadata-only body leak |
| Ministry | Research projects, teaching archive | Respective research/archive capability; never profile |
| Nonprofit Founder | Roadmaps, partners, meetings, research | Respective per-kind capability |
| Investor | Watchlists, theses, filings, briefs | Company research, thesis or filings as appropriate |
| Executive | Commitments, decisions, meetings, daily briefs, weekly reviews | Coordination, brief or review as appropriate |

This user-facing native read is **not cross-domain assistant sharing**.
OAuth client claims are rejected independently by both RPCs, even when the
actual connected account has all six bundle assignments. No shared-search MCP
tool is registered, and no Executive source-sharing permission is changed.

There is no new shared document corpus. Queries use existing private domain
tables and search indexes, scoped to the derived owner. Only current saved
records are candidates. Private profiles, unsaved recovery drafts, pending
proposals, previous versions, provider accounts and general Workspace tasks
are excluded. Existing source and task sharing controls remain unchanged.

## Failures, freshness and privacy

The HTTP request is streamed with an 8 KB upper bound and a strict input
schema. Query text is 2–200 characters; scope arrays are unique and bounded.
SQL repeats validation independently of HTTP. Responses are private/no-store,
strictly validated and contain no supplied destinations. Record links are
constructed from a known provider and a UUID, not returned arbitrary URLs.

Query text is not put in application URLs, browser storage, analytics or
search history. Saved snippets are plain React text, never injected HTML.
This is not a claim about infrastructure outside this implementation; approved
deployed logging/retention review remains a shipment gate.

Changing query/scope clears prior results and aborts the in-flight request.
Late responses cannot restore those results. Identity/workspace/authority
changes remount the search; leaving the visible tab clears results. A failed
search preserves the typed query but shows no partial or previous result set.
The UI distinguishes checking access, unavailable access, an assigned empty
catalog, zero matches and a failed search. Reloading scopes does not grant access.

## Page-bound preview work (P11a)

Migration 34 keeps the same native guard, request/result contract, full match
counts and ranking. The materialized match set contains identifiers, title,
revision, update time, scope and rank, not full bodies, document JSON or
search vectors. A materialized ranked page selects at most 25 candidates
before owner-and-ID-scoped reads prepare their original plain-text previews.
No data table, model tool, entitlement or sharing permission is added.

This targets work demonstrated in the actual 15,000-record local query plan.
It does not cap counts, omit candidates, change rank semantics or manufacture
a cache hit. PostgreSQL documents that multiply used materialized CTEs retain
their evaluated result, and ranking must still consider matching vectors.
See [CTE evaluation](https://www.postgresql.org/docs/15/queries-with.html#QUERIES-WITH-CTE-MATERIALIZATION)
and [text-search ranking and previews](https://www.postgresql.org/docs/15/textsearch-controls.html),
reviewed 2026-09-09. The inference for this query is to retain required
ranking while delaying expensive source-text preparation until the page is
known. Preview text is still displayed as plain text, not trusted HTML.

The P11a [scale ledger](../testing/workspace-search-scale-acceptance.md)
separates this controlled synthetic workload from representative retrieval
quality, concurrency, unaided value and deployed latency acceptance.

## Local verification environment

Windows reserved the former 58420–58427 range during P11. The existing named
fictional stack was moved to 58520–58527 without resetting data, changing its
project identity or modifying Windows/Docker system settings. Local scripts
and browser tests still assert the exact isolated project and API URL.
Historical P10 reports retain their original port evidence.

A second explicitly named database, bundle-search-fresh-p11 on 58620–58627,
replayed all 33 migrations and ran all 650 database assertions from a clean
start. It was stopped with its backup preserved and zero users retained.
The fresh verifier refuses to overwrite an existing run or backup.

See ../testing/workspace-search-acceptance.md for the final test ledger,
corrected attempts, screenshots, publication state and remaining release gates.
