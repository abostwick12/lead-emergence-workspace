# F06 — Quick Capture modal candidate

## Scope and acceptance boundary

IN SCOPE: Quick Capture dialog semantics, focus entry and containment, background exclusion, dismissal and focus restoration. Preserve capture fields, validation, persistence, draft handling and visual identity. No Connections popover, navigation, auth, account, entitlement, database or dependency changes are authorized. The owner authorized implementation, focused tests, commit, PR publication and review; merge and deployment require separate approval.

F06 remains OPEN until the deployed production interaction and actual screen-reader acceptance pass. DOM and browser accessibility-tree assertions are supporting evidence, not a screen-reader check.

## Preflight — November 13, 2026

VERIFIED: `git ls-remote origin refs/heads/main` returned `bf317e516ea214520989578be5b475f87d2446a1`. Read-only Vercel CLI `npx --yes vercel@60.1.3 api '/v13/deployments/workspace.leademergence.com?withGitRepoInfo=true&teamId=team_qEmWEp6Jzhtb2XP5c1jL9FB3' --method GET` returned READY deployment `dpl_9B12ChogGPKdKL8uxYUKmUnF9dnN` with the same source SHA, approximately 10:43 UTC. The Vercel connector returned 404; the authenticated CLI fallback succeeded. This agrees with the canonical production pointer; no state correction is needed.

VERIFIED: canonical control-plane `AGENTS.md`, roadmap, relevant decisions, production state, backlog and all three protocol skills were read from `main`. Phase 2/3 implementation is authorized with acceptance OPEN; the current owner prompt explicitly selects the bounded F06 slice. Only task-relevant deployment metadata was queried; billing, auth and database refreshes do not affect this modal change.

VERIFIED: `git worktree list --porcelain`, `git branch -vv`, `git status -sb`, open PR file lists and scoped worktree status/unique commit checks found no material ownership overlap for the component and new F06 test/evidence paths. PASS. The root checkout has unrelated changes and was not edited. Task worktree: `.f06-quick-capture-modal-20261113`; branch: `codex/f06-quick-capture-modal-20261113`.

VERIFIED: the historical audit's F06 (lines 147–153) records Shift+Tab from Close reaching the background Theme button. The deployed-source component blob is `746b1c1647f017bc9e6e4ee378f22da05dbebf2f`. Current main and deployed-source component content match. Source history contains the original custom dialog and later capability gating; no modal repair was found in that history. This session starts the first F06 implementation attempt found in the inspected history; unpublished prior attempts remain unknown.

The claim to test is that the current rendered dialog permits keyboard focus outside it. The cheapest falsifier is opening the actual component, focusing Close and pressing Shift+Tab: focus remaining inside would disprove the historical failure on this source. A simplified replacement modal is not valid evidence.

The closest existing supported modal pattern is native `dialog.showModal()` in `components/sotf/schedule-conversation.tsx` and `components/sotf/workflow-editor.tsx`. Quick Capture's sole component consumer is `components/workspace-shell.tsx`, which exposes the header button and Ctrl/Cmd+K. Shared consumers and shared styles are outside this correction.

## Local reproduction and validation

VERIFIED: before the product edit, the actual interactive `WorkspaceShell` and `QuickCaptureDialog` were source-loaded into Chrome with the real React runtime, icons, capability checks and `app/globals.css`. Only account/service/navigation boundaries were synthetic; outbound requests were blocked. The regression first confirmed textarea focus, then Close focus on Shift+Tab, then failed the expected wrap to Save capture on the next Shift+Tab. The captured active element was `<button id="background-action">Background action</button>`. The supervisor inspected the actual harness, failed-run record and error context. This reproduces escape into page content on the deployed source; it is not a fresh authenticated production observation.

Baseline evidence is retained locally under `test-results/f06-baseline/quick-capture-dialog-quick-dd139-keyboard-focus-in-the-modal-desktop/` (`error-context.md`, `test-failed-1.png`, `trace.zip`). The audited historical run landed on Theme; this local shell includes a synthetic background action after the header, so the exact escaped control differs while the same containment failure is observed.

VERIFIED supporting checks on the candidate: `npm run check:boundaries` passed (108 runtime files and 5 boundary tests); `npm run test:schema` passed 32/32; `npm run lint` passed; `npm run typecheck` passed; `npm run test:unit` passed 414/414 across 45 files. The initial restricted unit runner failed to collect tests because Windows denied temporary-file rename operations; the identical authorized rerun passed. This was a runner limitation, not a product failure or another repair attempt.

VERIFIED: `npm run build -- --webpack` passed compilation, TypeScript, all 30 static pages, optimization and build traces using synthetic public configuration (`NEXT_PUBLIC_SUPABASE_URL=https://synthetic.invalid`, synthetic anon key, local app URL). The first restricted build failed at generated-folder creation with Windows EPERM; the identical authorized rerun passed. Nothing was deployed. No pre-existing product test failure was encountered in the required checks.

VERIFIED: final focused command `$env:E2E_BASE_URL='http://127.0.0.1:3000'; node ../node_modules/@playwright/test/cli.js test tests/e2e/quick-capture-dialog.spec.ts --output=test-results/f06-final` passed 8/8 tests in 17.1 seconds. The supervisor independently reran the same spec with `--output=test-results/f06-supervisor`: 8/8 passed in 11.1 seconds. The external base URL suppresses the default dev-server startup; the spec uses `page.setContent` and performs no requests to that URL.

The tests cover the actual header button, Control+K and Meta+K on desktop and narrow layouts; textarea entry focus; three complete forward/backward cycles; visible Close/Save focus outlines; blocked programmatic background focus; native `:modal` state, accessible name and Chrome accessibility-tree background exclusion; Close, Escape and backdrop focus restoration; repeated reopen and unsaved-draft retention; zero capture calls and zero outbound requests. CDP accessibility-tree checks are explicitly not screen-reader acceptance.

VERIFIED visual evidence: the supervisor inspected [desktop](f06-modal-desktop.png) and [390px narrow](f06-modal-mobile.png) screenshots. The textarea focus ring, Close button and Save button are visible, the narrow layout wraps without horizontal overflow, and capture content remains usable. These images contain only synthetic local content.

## Correction and review

IN SCOPE: `components/quick-capture-dialog.tsx` now uses the existing native `showModal()` pattern to exclude background interaction, with explicit Tab endpoint wrapping and opener restoration on cleanup. Escape retains dismissal through the native cancel event. The native wrapper resets browser default sizing with component-local styles; existing panel classes, fields, validation and submit logic are unchanged. Shared modal components, `workspace-shell.tsx` and global CSS were not changed.

One implementation iteration included a bounded refinement: expanded testing found that default backdrop mousedown focus could overwrite restored opener focus. Preventing that default resolved the observed failure. Final focused tests, lint, typecheck and build passed after that refinement. No third repair variation was attempted.

VERIFIED independent review: a separate reviewer inspected the final component diff, actual-source test harness and evidence and returned no actionable findings. The supervisor separately inspected the diff, reran the eight focused tests, inspected visual evidence and checked `git diff --check`. Build readability checkpoint: PASS; the change is bounded to the existing component and focused test/evidence files.

The exact-current-head CodeRabbit result must be recorded in the PR/release handoff. This document does not assert that an unpublished candidate has passed that gate. Summary-only, skipped or rate-limited responses cannot satisfy it. No earlier manual exception applies.

## Production and screen-reader limitations

No authenticated production page was navigated or reloaded. Browser inventory exposed no existing Workspace tab; the canonical record also identifies a profile timestamp write on normal Workspace bootstrap, which this task does not authorize. No accounts or access were changed to manufacture a session. Production interaction acceptance is NOT TESTED.

Actual screen-reader announcement, focus and background-exclusion acceptance is NOT TESTED. A suitably equipped reviewer must perform it; browser DOM/ARIA/accessibility-tree checks do not close that requirement.

## Proposed release, rollback and production acceptance

After separate approval of the exact reviewed candidate, recheck main, PR head, review threads, required checks and the canonical production pointer. Stop for new overlap, drift or stale review. Merge only the approved candidate, verify the resulting tree, and use the existing reviewed deployment procedure; do not treat READY metadata as interaction acceptance.

Retain the pre-release canonical deployment as the rollback target. At this preflight it is `dpl_9B12ChogGPKdKL8uxYUKmUnF9dnN`, source `bf317e516ea214520989578be5b475f87d2446a1`. Rollback requires release authorization covering promotion of that retained deployment; recheck the pointer before release.

On the approved deployed version, use an existing authorized session without changing accounts or access. If reaching the page requires an unapproved bootstrap write, stop and request that specific authorization. Record UTC/local time, URL, deployment ID, SHA and sanitized evidence. Open from the button and keyboard shortcut; verify initial focus, forward/backward cycling, background keyboard/pointer and assistive-technology exclusion, Escape and Close dismissal, focus restoration, reopen behavior, accessible name and modal semantics at desktop and narrow sizes. Use empty input; never submit. Check actual screen-reader announcements and navigation. Confirm the open/dismiss path creates no capture or task through bounded request evidence. Only close F06 after all required production and screen-reader observations pass.
