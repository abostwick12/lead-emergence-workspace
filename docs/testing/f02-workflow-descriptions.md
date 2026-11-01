# F02 pilot workflow descriptions — local evidence

Date: 2026-11-01. Repository: `abostwick12/lead-emergence-workspace`.
Base: `7dea61e30463a57e34d56e7c6fd45c21f797fecc`.
Branch/worktree: `codex/f02-pilot-descriptions-20261101`, `.f02-pilot-descriptions-20261101`.

## Delivered boundary

IN SCOPE: the authorized SOTF pilot landing page, one declared transition-loop skill, and the five workflow definitions in the existing validated `sotf_transition` bundle release `1.0.0`. This is a description slice, not closure of the full F02 inventory or a customer release.

The page awaits the existing `connectedSotfExperience()` before returning descriptions. That existing helper still requires `SOTF_PILOT_ENABLED=true`, an authenticated user, and `sotf_has_access=true`; disabled, denied, and failed/unknown access remain hidden. No entitlement, authorization, feature flag, or navigation calculation changed.

Names, definition IDs, versions, ordering, and the skill outcome come from `resolveSotfRelease()` and its existing checked-in release definitions. Explanation copy is presentation only. The customer release index has an empty `approvedBundleManifests` list. Every card therefore says Pilot; the skill says Setup not checked. The page makes no installed, connected, last-run, successful execution, or active schedule claim.

Existing contracts:

- `lib/workspace/sotf-release.ts` validates the bundle release and digest.
- `lib/workspace/releases/sotf-transition/{bundle.json,ui-manifest.json,1.0.0.json}` owns the bundle definitions.
- `lib/workspace/releases/customer.v1.json` owns customer release approval.
- `app/workspace/sotf/connected-experience.tsx` owns the existing pilot/sign-in/access gate.
- `app/workspace/sotf/[section]/page.tsx` and `components/sotf/sotf-experience.tsx` own the existing web routes and actions.
- `lib/sotf/{intelligence.ts,mcp.ts,engine.ts}` owns preparation, supported tool modes, and confirmed changes.

## Capability matrix

All rows use bundle release `1.0.0`. All require existing applicable Workspace access/bundle entitlement and enabled pilot access. Web inputs can be supplied manually without third-party connections. Manage third-party services in the client's ChatGPT account; ChatGPT-to-Workspace authorization is separate. Host installation, connection health, and successful execution are unknown on this surface.

| Definition | Outcome and client input | Existing next action | Output, effects, limits |
|---|---|---|---|
| `sotf.skill.transition_loop` (bundle version `1.0.0`) | An evidence assessment and next move; supply a transition question, opportunity/conversation, and explicitly authorized evidence. | `/sotf/connect`: existing setup/resume guide; ask ChatGPT to resume and check accessible tools. If absent, use the web workflows. | Working output in the conversation. Workspace retention needs a supported confirmed save; the skill grants no storage. Installed/discoverable status is unknown. No automatic send/share/schedule. |
| `sotf.workflow.clarify_direction` `1.0.0` | Directions to test and criteria; supply timing, question, time available, work/environment preferences, and possibilities. | `#sotf-saved-work`: first-session form, then existing Direction controls. | Confirmed starting points/reviews retained in SOTF Workspace. Confirmation saves ordinary operational records. Hypotheses remain unproven; no send/share/schedule. |
| `sotf.workflow.assess_opportunity` `1.0.0` | Opportunity fit and unanswered questions; supply company, role, details, criteria, reviewed evidence. | `/workspace/sotf/opportunities`: Assess an opportunity or review an existing role. | Assessment in Opportunities; confirmed details/evidence/decision saved. No application submission or employer contact; missing evidence remains unresolved. |
| `sotf.workflow.prepare_conversation` `1.0.0` | Questions and conversation prep; supply person, objective, reviewed sources, saved questions/meeting details. | `/workspace/sotf/networking`: add/select a person, then Prepare conversation. | Prep in Networking, derived from explicitly saved operational records. Saving inputs changes records; preparing sends nothing and books nothing. Missing sources remain gaps. |
| `sotf.workflow.daily_brief` `1.0.0` | Next actions and why they matter; supply saved commitments, meetings, deadlines, follow-ups, directions. | `/workspace/sotf/briefs`: For today view. | Recomputed from saved records; the web view does not retain a separate brief artifact. No notification or schedule. May be empty. Distinct from the separate hosted contract. |
| `sotf.workflow.weekly_learning` `1.0.0` | What to start/stop/change; supply hypotheses, experiments, evidence, decisions, commitments, and learning. | `/workspace/sotf/learning`: Record what I will start, stop, and change. | Questions in Learning; confirmed review saved in SOTF Workspace. No silent preference change, coach share, or running weekly schedule. |

All descriptions keep Protected Professional Context unavailable and direct users away from saving private/sensitive context in ordinary operational records.

## Interaction and accessibility evidence

The agreed starting surface is the authorized pilot landing page `/workspace/sotf`. Every card shows its outcome, Pilot status, and next-action link without opening a menu. One click/Enter/Space opens its native `details` description; the next-action link is a second interaction from this surface. Enter/Space closes the disclosure and focus stays on its summary. Tab/Shift+Tab reaches the links without trapping focus. Touch opens/closes the same disclosure without hover.

BACKLOG — NOT PART OF CURRENT TASK: from the desktop dashboard, existing SOTF navigation plus opening a description is two interactions. On narrow screens, opening the existing sidebar first can make that three. The shell was not changed, and dashboard-to-description navigation was not exercised by the isolated render fixture. Discovery from the agreed pilot landing surface is the delivered slice.

## Focused validation

Command (PowerShell):

```powershell
$env:E2E_BASE_URL = 'http://127.0.0.1:9'
npx playwright test tests/e2e/sotf-workflow-descriptions.spec.ts
```

Result: **7 passed, 1 intentional skip**, 14.6 seconds. The skipped desktop test is touch-only; the mobile project runs it. No application server or live account is contacted. The spec source-loads the actual TypeScript server components, release resolver, JSON definitions, and existing gate with synthetic boundary dependencies. It renders the descriptions through React into Chrome with the existing CSS, then checks:

- All released definition cards, required explanation sections, supported link destinations, pilot/customer distinction, unknown host health, connection ownership, protected-context limit, and daily-brief contract separation.
- Desktop and Pixel 7 emulation, native keyboard open/close and retained focus, Tab/Shift+Tab link access, and mobile tap behavior.
- No network requests from the description render, no horizontal overflow, actual `experience` CSS class, and `innerWidth` equal to the configured viewport width (1280 desktop, 393 narrow).
- The actual existing connected helper and landing wrapper: flag disabled, signed out, denied access, failed/unknown access, and allowed pilot access. Denied cases return the existing redirect/not-found interrupt before descriptions render.

After adding individual open-card screenshots, the mobile content test was rerun with `--project=mobile --grep 'pilot descriptions cover'`: **1 passed**, 7.2 seconds overall (3.0 seconds test time). No product code changed for that capture.

Screenshots (local, untracked):

- `test-results/f02-descriptions-open-desktop.png`
- `test-results/f02-descriptions-keyboard-desktop.png`
- `test-results/f02-descriptions-open-mobile.png`
- `test-results/f02-descriptions-keyboard-mobile.png`
- `test-results/f02-description-{0..5}-mobile.png` (each open card at narrow width)

Desktop and final narrow screenshots were inspected. Narrow cards use one column, text wraps, links remain usable, and the focus outline remains visible. These are synthetic component renders, not a production screenshot, real authenticated route journey, or proof of backend workflow execution.

Test-harness corrections: initial browser creation failed because video recording required a missing sandbox-local ffmpeg binary; video is now disabled only for this spec. Before final visual evidence, the CSS-module stub was corrected to preserve default-import shape and the fixture received a viewport meta tag. Both properties now have explicit assertions. These changes do not change product behavior.

Repository checks coordinated by the supervisor: boundaries passed for 108 runtime files and five boundary-environment tests; schema contracts 32/32 passed; final typecheck and lint passed; unit run initially passed 390/391 with one stale direct-page shape assertion after adding the wrapper. PM approved adding `tests/sotf-manifest-routes.test.ts` to the boundary; its focused suite then passed 15/15 after that assertion was updated. Supervisor records the commit SHA in the handoff. Build completed successfully after an escalated retry; initial sandbox prerender `/privacy` mkdir EPERM was an environment failure. No unrelated product repair was made.

## Release and remaining acceptance

Production/data impact: **None**. No push, PR, review request, merge, deployment, production query, or data change is part of this implementation worker's work. Existing production observations and ownership preflight belong to the supervisor's evidence.

Production acceptance: **NOT TESTED**. After a separately authorized release, an authorized pilot user must reach `/workspace/sotf`, discover each included description and its existing next action within two interactions from that landing page, confirm the rendered availability/connection ownership/retention/effects match the deployed contracts, and complete the agreed supported next-action journey. A denied user must remain denied. Test records, sends, and booking need their own authorization where required.

BACKLOG — NOT PART OF CURRENT TASK: full F02 inventory reconciliation, customer release approval, actual ChatGPT package installation/discovery, connection-health observation, successful tool execution, the separate `transition.daily_brief` hosted contract, other prepare-tool modes, and running automation acceptance. The two declared automation definitions overlap these workflows; no summed capability count or running-schedule claim is made.

The supervisor inspected the source diff and desktop/narrow visual evidence. Final independent-review adjudication and the bounded local commit are recorded in the supervisor's handoff. Exact-head CodeRabbit review is unavailable until a separately authorized PR exists; this local slice is not reported merge-ready.
