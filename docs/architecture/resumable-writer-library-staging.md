# P20 resumable Writer library staging

Status: implemented and locally verified on `codex2/bundle-experience-integration`.
Portable source export: `f2c942da4bb09638f8f6c55bec8fb8740ebbc6c0`.
Overall client shipment remains **NOT READY TO SHIP**.

## User outcome

`/workspace/writing/bulk` turns a manageable folder of source documents into a
reviewable Writer staging table. A user can select up to 20 text, Markdown, Word
or text-based PDF files. Workspace processes three files at a time, preserves
successful extractions when another file fails, suggests titles and source
labels, and lets the user edit type, title, source, inclusion and full-text
limitations before importing.

The staging list autosaves to the server and returns after reload. Duplicate
review distinguishes exact matches already in the user's library from matches
within the staged set. Excluding a resource or changing any field invalidates
the review and requires a fresh check. One explicit confirmation imports all
included resources as private drafts or imports none.

## Limits and non-retention

The final exported contract fixes these host-independent ceilings:

| Boundary | Limit |
| --- | ---: |
| Files/items per batch | 20 |
| File bytes | 4,000,000 each |
| Extracted characters | 100,000 each |
| Aggregate extracted characters | 500,000 |
| Staging JSON request | 650,000 bytes |
| Parallel extractions | 3 |

The P19 extraction route remains the only parser boundary. It authenticates
before reading a bounded multipart body, authorizes the fixed Writer destination
and returns plain text plus a SHA-256 receipt. The client and batch database
store no `File` or binary. Only reviewed extracted text and filename can enter
private staging and, after confirmation, normal Writer resources. Formatting,
images, attachments, macros and PDF actions are not retained.

## Authority and private storage

Migration `20260915150000_writer_bulk_library_import.sql` creates:

- `workspace_private.writing_import_batches`, one versioned slot per personal
  workspace;
- `workspace_private.writing_batch_import_receipts`, an idempotency receipt
  containing resource identities and titles, never extracted body text.

Both tables have RLS enabled and no direct anonymous or authenticated table
privileges. All five public RPCs derive the personal workspace from the bearer,
require current `writer.resource.manage` and `writer.resource.review`, and call
the existing native-session gate. OAuth-shaped assistant sessions cannot read
staging text, review it, mutate it or replay the user's approval. Revocation is
rechecked before receipt replay.

The authenticated, bearer-only, no-store API surface is:

- `GET|POST /api/writing/bulk` — read/save exact-version staging;
- `POST /api/writing/bulk/clear` — write a content-free tombstone;
- `POST /api/writing/bulk/review` — calculate exact duplicate evidence;
- `POST /api/writing/bulk/commit` — confirm one atomic import.

Bodies are streamed with the existing 650,000-byte ceiling. Zod validates at
the API boundary; PostgreSQL independently validates strict object keys, UUIDs,
field lengths/types, archive receipts, uniqueness, item/aggregate limits and
canonical numeric/identity forms. Request UUIDs identify exact retries and do
not confer authority.

## Concurrency, duplicates and commit

Save and clear use an optimistic batch version plus a per-signature request
UUID. A newer tab wins without overwriting the older tab's on-screen items. A
tombstone increments the version, so an old autosave cannot resurrect text after
discard or commit.

Review serializes with every existing Writer write on the workspace advisory
lock. It compares normalized recorded text and normalized titles, confirms full
text equality after the existing hash index narrows candidates, and returns at
most 40 candidates per item. It does not perform semantic matching, plagiarism
detection, link verification, merging or deletion.

The review token hashes the reviewed batch version and deterministically ordered
candidate evidence. Commit acquires the same workspace lock, checks the exact
version, recalculates the evidence and rejects a changed token. It then calls the
existing idempotent `writer_import_resource` for each included item inside the
same PostgreSQL transaction. Any failure rolls back every new resource. Success
records a body-text-free retry receipt and replaces staged text with a tombstone.

## Release boundary

This is a generic native workflow with fictional local proof. It does not read a
client folder, migrate a representative full library, decide canonical
duplicates, verify links, access Wix, publish a website, prove installed
ChatGPT/Codex behavior, exercise hosted privacy/recovery/support, or enforce a
commercial plan. Those remain release gates.
