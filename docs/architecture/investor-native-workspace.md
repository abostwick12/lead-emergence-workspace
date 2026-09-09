# Investor native research workspace

Implementation checkpoint, 2026-09-09. This is not client-shipment approval.

## Ownership and access

The reusable bundle owns schemas, analysis rules, manifests and the assistant
skill. Workspace imports a twenty-one-file SHA-256-checked allowlist and owns
the native application, persistence and authorization bridges. Investor uses
independent private documents, versions and proposals, plus private public-source
rate-control tables. All five tables have RLS and deny direct anonymous and
authenticated reads/writes. Application runtime has no service-role client.

Three current capabilities admit four research kinds: company_research admits
watchlists and market briefs; thesis admits company theses; filings admits filing
reviews and bounded public SEC metadata reads. The research desk remains reachable
when any of these is admitted. Each list, read, proposal, save, history and
attention request derives workspace identity from the verified caller. A caller
cannot supply tenant authority or reuse Writer, Ministry or Nonprofit IDs.

The migration embeds base JSON schemas generated from the reusable Zod contracts.
A host test checks exact structural parity. A private recursive validator handles
only that trusted schema vocabulary, not caller-provided schemas or remote refs.
SQL independently enforces source/claim references, distinct IDs, date ordering,
filing limitations, evidence-backed conclusions and complete scenario sets.

## Useful research loop

- Watchlists retain a reason to watch, next question, instrument identity and
  review date. They do not import positions or show live prices.
- Theses retain a question, working view, horizon, subjective confidence,
  supporting/challenging claims, observable invalidation and change assessment.
  Even a no-material-change conclusion requires a reason and recorded evidence.
- Filing reviews distinguish the subject from the filer, accession/form,
  filing date from reporting period, amendments, Form 4 transaction/footnote/plan
  context and 13F holdings/lag limitations.
- Briefs retain the market/company scope, exact research window, summary,
  evidence, catalysts, uncertainty and highest-value next question.

FACT, INTERPRETATION, THESIS, SCENARIO and PREDICTION are claim categories, not
verification labels. Fact claims require local citations. Sources retain title,
publisher, public URL, date, reporting period, actual retrieval timestamp,
reference, brief excerpt, limitations and review status. Retrieval timestamps
start blank for a new manually entered source. Recording retrieval now is an
explicit action; importing public metadata uses the real lookup timestamp.

Sources cannot be removed while claims/catalysts/invalidation conditions cite
them. A link is not a verified source. The thirty-day retrieval-age warning is a
question-dependent review heuristic, not a guarantee of accuracy or an official
expiry rule. Missing challenging evidence is a research gap, not proof it does
not exist. Future-relative retrieval dates are also visible in source warnings.

Catalysts distinguish unknown, estimated, announced and occurred dates. Announced
or occurred events need evidence. Scenarios are optional hypothetical assumptions:
only an explicitly complete, mutually exclusive set with at least two entered
probabilities totaling 100% and every return entered produces a weighted return.
No missing value is imputed to zero; these are not calibrated probabilities.

Attention uses saved revisions and the server date to identify review dates,
research gaps, recorded challenges and catalysts. It does not scan live markets,
receive new filings, prove no change, schedule alerts or execute trades.

## Assistant proposals and native recovery

Thirteen private MCP tools expose four list/read/propose groups and attention.
Only the four proposal tools write state. One additional read-only, open-world
tool performs the bounded public SEC lookup. Annotations describe behavior;
per-request database authority enforces it, including revocation/disconnect.

Assistant proposals bind to the exact immutable base revision. Changed sources
become unverified. Changed claims, including unchanged claims whose cited source
changed, become inferred. A changed record becomes review_required. Repeated
identical requests normalize against the original base, not a later revision.

The user compares the complete proposed record with the latest saved record.
Approval is disabled for stale proposals and requires public-research-only
confirmation; rejection does not require affirming the content. Approval does
not upgrade inferred claims into independently verified facts. Pending, approved
and rejected proposals remain inspectable. Canonical saves, proposal decisions
and private revision history are direct-user operations, not assistant tools.

Stable request IDs protect identical retries. Concurrent/stale saves fail without
silently overwriting work. All saved versions are retained; the original and
latest nine are exposed in native history. Restoring makes an editable copy that
requires a new confirmation/save. TXT handoffs include only the selected saved
revision, with evidence and cautions; unsaved edits and proposals are excluded.

## Public SEC lookup and actual integration status

An explicit ten-digit public CIK and form/count filters are the only request
inputs. The server fetches a fixed data.sec.gov submissions endpoint, does not
follow redirects, declares its automated identity, limits requests globally to
one reservation per 250ms and per workspace to ten per minute, bounds response
size to 5 MB and fetch time to twelve seconds, and rechecks access before release.
The private budget stores workspace timing/counts, not CIKs or research content.

Returned filing links are constructed under the fixed SEC archive host. Identity,
column lengths, dates and safe document paths are checked before any result is
released. Coverage reports scanned/matching/returned counts, date range,
truncation and the existence of unsearched older-history files. This is recent
filer metadata, not full filing analysis or complete issuer-wide insider coverage.

Import is explicit, limited to a draft without prior filing evidence, and never
saves a canonical record. It labels the source unverified and states that the
filing text, tables, footnotes and amendments were not read by the lookup.
No personal account or Finances installation is required. Optional Finances
metadata was inspected only; account scopes and available runtime fields remain
unverified. No personal account was installed, connected or accessed.

One actual public SEC lookup through the isolated preview returned upstream 403;
the app returned a descriptive 503 and no findings. No retry, identity rotation
or evasion was attempted. **Live upstream success is not proven.** Before
enabling this feature for clients, the operator must approve its declared contact
identity and aggregate traffic controls, and demonstrate successful authorized
public reads. Native manually recorded research remains independent of lookup.

Sources inspected 2026-09-08: [SEC public APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces),
[SEC automated-access guidance](https://www.sec.gov/about/webmaster-frequently-asked-questions),
[Form 13F FAQ](https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/frequently-asked-questions-about-form-13f),
[Form 4 instructions](https://www.sec.gov/files/form4.pdf) and
[OpenAI MCP guidance](https://developers.openai.com/plugins/build/mcp-server).

## Experience and release limits

Routes are /workspace/investing and /:kind, /:kind/new, /:kind/:documentId and
/:kind/proposals. The editor separates overview, evidence, catalysts and thesis
scenarios. Confirmation resets on edits. Errors preserve on-screen content;
requests time out after twenty seconds; unsaved-navigation warnings exclude
new-tab source inspection and downloads. The shared mobile header reserves space
for navigation rather than leaving its button over scrolled form controls.

Structured account/trade fields and cross-domain record shapes are rejected.
Free text is not automatically classified or redacted for account information
or material nonpublic information. Users must review it before saving/sharing.
Downloaded copies are not retroactively revocable, and rejected proposals/history
are retained rather than erased. Public availability of a filing does not verify
its content, imply motive or authorize a trade.

Remaining client gates include crash/autosave recovery, representative filing
and thesis-quality evaluation, measured unaided first value/time saved,
large-library ergonomics, physical-device/accessibility acceptance, installed
ChatGPT/Codex use, successful live public lookup, deployed retention/rollback,
payment enforcement and the remaining native bundles. No hosted migration,
production deployment, marketplace submission or installed-plugin update occurs
as part of this checkpoint. All six bundles remain NOT READY TO SHIP.
