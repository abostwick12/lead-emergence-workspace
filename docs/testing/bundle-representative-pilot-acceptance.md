# P17 representative-pilot kit acceptance ledger

Milestone: P17, 2026-09-10. Pilot-preparation checkpoint, not client shipment.
Host branch: `codex2/bundle-experience-integration`; starting HEAD
`337a35c6143dfcd634680171309d552bdb347066`. Portable branch:
`codex2/bundle-platform-v1`; final source pin
`a6967ae011ceca2ab683f29b0a9362d337465fe2`. All six bundles remain
**NOT READY TO SHIP**.

See [the pilot design and authority boundary](../architecture/bundle-representative-pilots.md).

## Final local checks

| Check | Outcome |
| --- | --- |
| Portable type checking and tests | PASS: 189 tests in 19 files |
| Portable kit parity | PASS: exactly six kits; manifest versions, targets, and signal IDs match all six manifests |
| Portable decision oracle | PASS: rehearsal exclusion, repeated-use threshold, strong cohort, weak cohort, duplicate, cross-bundle, and undeclared-signal cases |
| Host type checking and lint | PASS |
| Host unit tests | PASS: 323 tests in 37 files |
| Schema-policy contracts | PASS: 32 |
| Runtime product boundaries | PASS: 275 files; no forbidden cross-product import or service-role client |
| Optimized local-public-config build | PASS: 57 generated pages/routes |
| Optimized desktop/mobile browser suite | PASS: seven cases; one intentional mobile duplicate of desktop-only lost-response injection skipped |
| Focused screenshot rerun | PASS: two cases, desktop and mobile |
| Visual review | PASS: collapsed disclosure, rehearsal warning, packet, timed task, rubric, controls, responsive stacking, and no horizontal overflow |
| P16 database authorization | UNCHANGED: no migration or database code changed; the prior 42-migration / 1,141-assertion evidence was not rerun as P17 evidence |
| Representative client outcome | NOT RUN: fictional packets are explicitly excluded from advancement evidence |
| Installed ChatGPT/Codex and deployed environment | NOT RUN |

## Browser behaviors proven

- All six bundle cards retain their manifest promise, expected outcome, target,
  availability, and private value-check controls.
- The guide is collapsed by default and opens from a keyboard-native disclosure.
- Writer's guide identifies the packet as fictional and states that it is never
  client work or measured client value.
- The nested source packet opens separately and labels each source layer, content,
  and handling rule.
- The timed task, observable “done when” evidence, critical quality criteria, and
  representative-attempt threshold remain available in the same guide.
- Existing start/reload/finish, exact-retry, assignment-limit, bearer-denial, and
  responsive-overflow behaviors remain green in the focused production suite.

## Verification limits

The browser tests verify one guide interaction deeply at desktop and mobile sizes;
portable parity tests validate all six definitions. This milestone does not claim
that an actual participant completed any scenario, that static fixtures exercise
every native domain write, or that the portable cohort evaluator is a deployed
operator dashboard.

No client material, provider, external account, hosted project, payment system,
marketplace listing, `main` merge, or production deployment was touched. The next
release gate remains authorized representative attempts, not more synthetic wins.
