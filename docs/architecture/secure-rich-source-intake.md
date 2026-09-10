# P19 — secure rich-source intake

Milestone: P19. Host branch: `codex2/bundle-experience-integration`, starting
HEAD `ab8bde9c9a89e3db2b5c2b96340b0ba25db662b7`. Portable source pin:
`b48cc56292e910389b1e356f891f2ad8227d8b1c`. Overall client shipment remains
**NOT READY TO SHIP**.

## User flow

Writer resource import and Ministry teaching archive use the same
`SourceFileIntake` control. A signed-in user chooses one text, Markdown, Word or
text-based PDF document. Workspace extracts plain text and displays the reviewed
filename, word/character/page counts, a bounded preview and format limitations.
The user must explicitly use or replace the draft text. That action updates only
the existing protected native working draft; it does not save a canonical
record, approve a proposal, confirm a belief or publish anything.

The original file is never written to application storage. Only the extracted
text and a user-visible filename can flow into the destination's normal save.
The extraction response carries a SHA-256 receipt but the UI does not treat it
as source verification.

## Request and authority sequence

`POST /api/source-intake/extract` is Node-only, dynamic and non-cacheable:

1. authenticate the bearer session before reading the body;
2. require multipart content while preserving its case-sensitive boundary;
3. stream the body through the 4.25 MB request ceiling;
4. accept exactly one fixed purpose and one file, with no tenant identifiers;
5. call `workspace.authorize_source_intake` before parsing;
6. validate filename, extension, MIME hint, byte count and signature;
7. extract bounded plain text and return `no-store`, `nosniff` output.

The database derives the workspace from the direct session. Writer intake
requires both `writer.resource.manage` and `writer.resource.review`; Ministry
requires `ministry.archive`. Anonymous callers, OAuth/client sessions, foreign
owners and revoked entitlements fail closed. Assistants cannot submit files.

## Parser boundary

Text and Markdown require valid UTF-8 and reject NUL data. Before Mammoth receives
a DOCX, Workspace inspects its ZIP central directory for multi-disk/ZIP64
markers, traversal names, duplicate entries, required Word entries, entry count,
per-entry size, total expansion and compression ratio. Mammoth's raw-text API is
used; HTML output is never requested or returned.

PDF.js receives bytes only, stops on parser errors, does not use worker fetch,
system fonts or WebAssembly, and is externalized from the Next server bundle so
its Node worker module stays resolvable. Workspace visits at most 100 pages and
uses only text content. Password-protected, unreadable and likely scanned PDFs
return bounded user guidance. OCR, rendering, embedded actions, images,
attachments, annotations, links and document metadata are outside P19.

All formats share the portable limits in
`vendor/lead-emergence-bundles/domain-contracts/source-intake.ts`: 4 MB files,
100,000 extracted characters, 100 PDF pages, 500 DOCX entries, 15 MB total DOCX
expansion, 10 MB per DOCX entry and a 200:1 aggregate compression ratio.

## Failure and recovery

A failed selection leaves current draft text unchanged. Abort/timeout, invalid
format, unsafe archive, parser failure and OCR guidance are distinct, bounded
messages with no parser internals. The preview can be discarded. After apply,
the user reviews the complete editable text and uses the existing retry-safe
canonical save. Revision recovery remains owned by Writer or Ministry.

This is secure single-document intake, not bulk migration or representative
document-quality proof. See [the P19 acceptance ledger](../testing/secure-rich-source-intake-acceptance.md).
