# Writer approved revisions — P3 native slice

Date: 2026-09-08. Status: implemented and locally validated, **not a client shipment**.

## User outcome

Import pasted text or a .txt/.md file, retain the source, see recorded review
gaps, prepare editorial/metadata improvements, compare the exact saved changes,
and approve a new private-library revision. The original remains accessible
even after more than ten revisions. Files are read as plain text in the browser;
no binary-file storage, Word/PDF parsing, website fetch or external publication
is implied.

The native editor supports title, author, audience, topics, summary, body text,
website summary, SEO description and library state. The canonical metadata
contract also supports themes, scripture references, series, keywords,
same-workspace related/duplicate candidate IDs and recorded file/provider
references. Those references are provenance labels, not proof of a provider
connection, uploaded binary or verified duplicate.

## Authorization and data model

- Existing Writer catalog gains metadata/proposal and manage capabilities;
  catalog migration assigns no client access.
- A verified direct user session with manage capability can import. Reading and
  proposing retain their own capability checks.
- MCP can save a proposal with metadata + review capabilities. It cannot import
  canonical content or approve/reject; database checks deny those RPCs even if a
  client bypasses tool discovery.
- Resource IDs never establish access. Workspace and owner are derived from the
  authenticated bearer; all private tables deny direct authenticated privileges.
- Immutable proposal identity + base revision binds approval to the stored patch.
  The API accepts no replacement patch or model-supplied approval flag.
- A per-workspace transaction lock serializes imports, proposals and decisions.
  Concurrent approval of two proposals based on the same revision yields one
  success and one conflict, not last-writer-wins content loss.
- Stable request IDs replay identical import/proposal requests; differing content
  with the same ID conflicts. Approval replay does not create another revision.
- Source attribution and epistemic state cannot be changed through an editorial
  patch. Human approval records an editorial action; it does not certify every
  underlying claim as confirmed fact.
- Draft/in-review/ready/archived are private library states. A proposal cannot set
  published. No Wix or other provider mutation exists in this slice.
- Metadata replacement preserves explicit whole-object semantics. Related IDs
  must belong to the same Writing workspace during import and proposal.
- Database and web schemas independently enforce bounded fields, strict keys and
  types. Web JSON is streamed with a 650,000-byte cap; body text is at most
  100,000 characters. There is no cookie-authorized mutation or permissive CORS.

Tables: writing_resources, writing_revisions, writing_proposals and
writing_import_requests in workspace_private. All SQL is in the new migration
20260909090000_writer_approved_revisions.sql. History returns at most 50 proposals
(pending first) and 10 snapshots (latest nine revisions plus original).
Intermediate older revisions remain stored but do not yet have a paged UI.

## UX safeguards

Approval starts disabled; the user reviews a saved before/after comparison and
checks the confirmation box. Stale comparisons cannot be approved. A rejected
proposal never changes canonical content. Forms retain text on a failed save,
disable inputs during submission and reuse retry IDs. Domain content and local
editor components unmount when identity/access is no longer admitted. No private
drafts are stored in browser localStorage. Unsaved edits are not autosaved and
can be lost on navigation; durable draft recovery remains follow-up UX work.

The same immutable comparison covers assistant-generated and native proposals;
origin, reason, basis, revision, status and decision history stay explicit.
Source text is rendered as text, never executable markup.

## Validation and remaining release work

See ../testing/test-evidence.md for commands, results, images and limitations.
The optimized native browser journey passes in desktop/mobile Chrome. Actual
OAuth/MCP tests use the development-mode loopback server: production deliberately
rejects a noncanonical local MCP host with HTTP 421. Do not weaken that check to
make local tests green. A real approved canonical-host preview is still required.

The guide's build-chatgpt-app skill is unavailable in this session. Available
OpenAI documentation and current plugin/skill authoring validators were used;
no historical plugin format, invented app ID, custom provider OAuth, or installed
host proof is substituted. The Writer skill now routes optional saved proposals
to the real tool and leaves approval to the user.

Next: finish the practical Writer workflow (confirmed voice/taxonomy, related and
duplicate candidates, evidence-led link checks, publication export/preparation
and draft recovery), then reuse the tested domain boundary for Ministry.
External Wix and installed-host acceptance require the proper authorization and
integration owner. Track the entire six-bundle release in the bundle repository
at docs/release/client-readiness.md.
