# Writer confirmed preferences and publication preparation

P5 native checkpoint, 2026-09-08. This is not a client shipment, website
publication, hosted deployment or installed ChatGPT/Codex acceptance.

## First useful outcomes

1. From the Writing library, open Writing preferences & taxonomy. Record only
   the voice, readers, boundaries and labels that matter, then explicitly
   confirm. No first-client wording, theology or provider configuration is
   inherited. A connected Writer assistant can read the current confirmed
   profile; an empty profile is reported as unset.
2. Open a resource with confirmed guidance visible. Choose a preferred topic or
   theme that fits the source. This creates an ordinary immutable proposal;
   the source remains unchanged until the user compares and approves it.
3. Prepare a publication packet from a saved resource revision. Copy the saved
   text or website summary, or download a TXT/JSON handoff with source details,
   metadata and a review checklist. This does not publish anything.

## Storage and authority

Migration `20260909110000_writer_preferences_and_publication.sql` adds only
catalog configuration and domain-private data/functions. It assigns no bundle.
Portable `writer.profile` maps to database capability `writer_profile`.
Native and MCP resolution use the existing server-side entitlement authority.

`workspace_private.writing_profiles` holds the active workspace-owned profile;
`writing_profile_revisions` preserves private confirmation history. Both have
RLS and no direct public/anonymous/authenticated table privileges. The database
records the confirming identity and timestamp; transport results omit actor IDs.

Bounded fields are voice notes, audience notes, editing boundaries, publication
preferences, preferred/avoided wording, topics and themes. Unknown fields,
belief/status/tenant overrides, duplicate labels and invalid types fail closed.
Each list has at most 100 labels; labels are newline-delimited in the editor so
a comma inside a label is preserved. The schema is writing context, not a
theological profile. User statements are not independent factual verification.

Only a direct signed-in user can call `writer_save_profile`, with an explicit
confirmation, expected revision and request UUID. OAuth assistant credentials
cannot confirm even via direct RPC. Identical retries of the current save are
safe; changed requests, stale tabs and replay of a superseded save conflict.
`writer_get_profile_history` is also direct-session-only and returns the latest
ten snapshots. Loading an old snapshot fills the editor but requires a fresh
confirmation to apply. Clearing all fields is not saved until confirmed, and
clearing the active profile does not erase its recovery history.

## Publication boundary

`writer_publication_context` checks review access, the resource's ownership and
the exact current revision. It reads canonical source data and a pending
proposal count. Server-side `preparePublication` allowlists the outgoing
packet. Stored file paths, provider record IDs, internal abstract, writing
preferences and working drafts are not added. Pending proposal text is not
included. Canonical text is retained literally and may itself contain private
information: users must review the text before sharing. This is not redaction.

Metadata presence is distinguished from accuracy, voice, rights, destination
and publication approval: those five checks always require human review.
Missing metadata, pending proposals, archived state and uncertain recorded
evidence receive explicit warnings. No URL is fetched, no SEO result is promised,
and no resource state changes. Browser copies/downloads reauthorize and reread
the exact revision immediately before output; stale packets must be rebuilt.
Downloaded copies leave Workspace's control and are not revoked retroactively.

MCP tools `writer_get_profile` and `writer_prepare_publication` are read-only,
bounded, closed-world and capability-filtered. The latter takes resource ID and
expected revision, not tenant identity or arbitrary URLs. It returns a packet,
not a claim that a local file was created. Native export buttons create the file
only after the user's explicit click. Existing proposal tools stay write-marked;
assistant publication, confirmation and approval tools are not advertised.

## Recovery and UX

Unconfirmed preferences remain on screen during save errors and conflicts.
They are not autosaved, supplied to the assistant or stored in browser local
storage. Navigation/reload warns before abandonment. Revoked or unverifiable
access removes the private editor and content. Reloading current preferences
requires confirmation before replacing dirty edits. Authorization, profile
history and publication responses are private/no-store.

## Verification and remaining gates

See `docs/testing/test-evidence.md`, `docs/runbooks/writer-local-proof.md` and
the successful-screen evidence in `docs/testing/writer-proof/` for actual counts.
Tests use fictional accounts on isolated `bundle-experience-p2`, never a hosted
project. Real OAuth tests run in development mode; the optimized loopback app
does not bypass the production MCP canonical-host guard.

Still required: representative-library/user-value pilot; rich file ingestion;
deeper native metadata workflows; link verification; authorized Wix integration;
installed host, Entry/consent, hosted recovery, privacy/retention/export and
payment-enforcement acceptance. The other five bundles still need their full
native workflows. Public source or passing validators do not satisfy these gates.

## Official OpenAI guidance used

The [MCP server guide](https://developers.openai.com/plugins/build/mcp-server)
informed focused tool boundaries, explicit input/output schemas, per-request
authorization and accurate read/write annotations. Tool descriptions disclose
missing verification and separate suggestions from canonical decisions. The
available official plugin/skill validators check the reusable source packages;
they do not prove installed-host behavior. No model API or provider credentials
were added for this checkpoint.
