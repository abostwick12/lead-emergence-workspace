# P16 — private bundle first-value pilots

Milestone: P16. Host: `abostwick12/lead-emergence-workspace`, branch
`codex2/bundle-experience-integration`, starting HEAD
`9617e260385df7c589cc4add86375791fd7b633f`. Portable contract:
`abostwick12/lead-emergence-bundles`, branch `codex2/bundle-platform-v1`,
pinned source `1078b4e3ff6201160a1efdbe724e2577dd7ef925`. Overall client shipment
remains **NOT READY TO SHIP**.

## Product experience

The value page asks one practical question: does each assigned bundle earn its
place? Every card comes from the portable manifest's promise, expected first
outcome, target minutes and success signals. A user estimates how long the same
task normally takes before starting, opens the real bundle workspace, returns to
record the actual result, and can stop honestly when the task is interrupted or
the workflow, outcome or sources are inadequate.

Completion records whether the expected outcome occurred, which declared signal
occurred, 1–5 usefulness/trust/actionability ratings, correction count, and
whether evidence, provenance and mutation-control gates held. Elapsed time is
measured from server timestamps. Estimated time saved uses the pre-work baseline
and never goes below zero.

Results are labeled “strong user-reported signal,” “promising user-reported
signal,” or “needs iteration.” The interface explicitly states that one session
is not representative proof. A completed result leads; repeating a measurement
is a secondary deliberate action. Unassigned bundles explain their state and
disable start controls before the user can fail into an authorization error.

Settings provides a discoverable entry point. The full flow is responsive and
keyboard/label accessible on desktop and mobile.

## Data and authority boundary

The portable contract admits no prompt, source material, source excerpt, output,
notes, contact data, provider data or other client work. Only bounded bundle IDs,
declared signal IDs, enums, booleans, small ratings/counts and time measurements
cross the boundary. Browser storage is not used.

The host derives definitions from the 37-file pinned portable export. A separate
private database catalog independently fixes manifest versions, target minutes,
entry capabilities, signal IDs and required gates. Starting therefore requires
agreement between two authorities plus the current entitlement.

Sessions and exact-retry receipts live only in `workspace_private`, have RLS,
grant no direct role access and bind receipts to the same workspace, user and
session. Native functions require a direct owner session and deny anonymous and
OAuth/client credentials. One active session per bundle prevents accidental
overlap. An advisory lock serializes owner operations; request hashes and
optimistic versions make start, finish and stop retry-safe. A changed request ID
payload fails instead of being reinterpreted.

Completed history remains owner-visible after a bundle is revoked so negative
evidence is not erased. New starts and new completions still require current
bundle authority. An exact already-completed receipt can replay after revocation
to resolve a lost response without creating new authority.

## Interpretation limits

The baseline and ratings are user reports; only elapsed time is measured by the
server. The resulting estimate is not causal evidence, a billing claim, or a
guarantee of future savings. Synthetic local acceptance verifies mechanics and
boundaries, not the quality of a real client outcome.

The next step is to run the exact flow with a small authorized representative
dataset and an unaided user, record corrections and abandonment, then repeat the
same cases in an approved installed non-production ChatGPT/Codex host. No client
account, provider, hosted database, payment system or production environment was
used in P16.
