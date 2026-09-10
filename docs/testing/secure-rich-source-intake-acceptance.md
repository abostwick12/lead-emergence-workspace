# P19 secure rich-source intake acceptance ledger

Milestone: P19, 2026-09-10. Local implementation checkpoint, not client
shipment. Host branch: `codex2/bundle-experience-integration`; starting HEAD
`ab8bde9c9a89e3db2b5c2b96340b0ba25db662b7`. Portable branch:
`codex2/bundle-platform-v1`; source pin
`b48cc56292e910389b1e356f891f2ad8227d8b1c`. All six bundles remain
**NOT READY TO SHIP**.

See [the implementation and authority boundary](../architecture/secure-rich-source-intake.md).

## Final local checks

| Check | Outcome |
| --- | --- |
| Portable source type checking and tests | PASS: 203 tests in 20 files |
| Host source export | PASS: 39 allowlisted files pinned to `b48cc56292e910389b1e356f891f2ad8227d8b1c` |
| Focused extraction and HTTP boundary | PASS: 13 tests, including Word, PDF, malformed input, archive limits and mixed-case browser boundary |
| Host type checking and lint | PASS |
| Host unit tests | PASS: 336 tests in 39 files |
| Schema-policy contracts | PASS: 33 |
| Runtime product boundaries | PASS: 279 files; no forbidden cross-product import or service-role client |
| Complete local bundle database suite | PASS: 1,336 assertions across 27 rollback-only suites |
| Optimized local-public-config build | PASS: Next 16.3.4, 57 generated pages/routes |
| Desktop/mobile browser acceptance | PASS: Writer DOCX and Ministry PDF flows in both projects |
| Dependency audit | PASS: zero known vulnerabilities after the Next 16.3.4 and parser dependency update |
| Fresh database replay | UNCHANGED: P19 applied one additive migration to the retained isolated P18 stack |
| Hosted, installed-host and representative-client proof | NOT RUN |

## Browser result

Writer imports a generated DOCX through the real optimized route, previews its
limitations, explicitly applies the extraction, receives title/source
suggestions, survives an injected canonical-save failure, saves the resource,
compares and approves a proposal, reloads revision 2 and recovers the original.
The complete path passes in desktop and mobile-emulated Chrome.

Ministry imports a generated real PDF, reviews its one-page extraction, applies
it to the protected archive draft, saves it through the ordinary native editor,
finds the record by extracted content and proves another Ministry owner cannot
read the identifier. The path passes in both browser projects.

## Security result

The new PostgreSQL suite passes 11 assertions. The authorizer derives the tenant
from the direct session, accepts only `writer_resource` and `ministry_archive`,
checks current destination capabilities, rejects OAuth-shaped sessions before
MCP workspace resolution, rejects an unentitled second owner and closes Writer
intake immediately on revocation without affecting a valid Ministry grant.

Unit tests exercise UTF-8 normalization, real DOCX raw-text extraction, central-
directory counts, a DOCX entry-count bomb, truncated ZIP input, a real PDF text
stream, invalid signatures/encoding and safe HTTP errors. Browser testing found
and closed a case-sensitive multipart-boundary bug. Optimized testing found and
closed the PDF.js worker-resolution boundary by externalizing the Node package.

## Verification limits

No client document, provider account, hosted project, production environment,
marketplace listing, payment system or `main` branch was touched. The evidence
does not cover scanned/OCR documents, bulk imports, every real-world Word/PDF
feature, malware scanning at a deployed edge, representative extraction quality,
installed assistants, hosted limits, backup/retention or support operations.
