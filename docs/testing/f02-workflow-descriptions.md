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

## Historical interaction and accessibility evidence — November 1, 2026

The agreed starting surface is the authorized pilot landing page `/workspace/sotf`. Every card shows its outcome, Pilot status, and next-action link without opening a menu. One click/Enter/Space opens its native `details` description; the next-action link is a second interaction from this surface. Enter/Space closes the disclosure and focus stays on its summary. Tab/Shift+Tab reaches the links without trapping focus. Touch opens/closes the same disclosure without hover.

Historical backlog at the November 1 checkpoint: from the desktop dashboard, existing SOTF navigation plus opening a description was two interactions. On narrow screens, opening the existing sidebar first could make that three. That slice did not change the shell or exercise dashboard-to-description navigation. The November 2 dashboard-shortcut slice below supersedes this local navigation limitation; production acceptance remains untested for that later slice.

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

## Additional preparation descriptions — November 2, 2026

IN SCOPE: eight additional modes of the existing `sotf_prepare_next_move` contract: `coaching`, `networking`, `stories`, `interview`, `offers`, `professional_work`, `scheduling`, and `invitation`. These are not eight new released workflow definitions, independent versions, or proof of successful execution. The first six cards above remain unchanged. Five other modes (`opportunity`, `meeting`, `direction`, `weekly`, `daily`) overlap the five existing released workflow descriptions; counts must not be added together as separate capabilities.

Base: `85760eac37d95ba8467ec4e51184eaa3cf767634`, confirmed by `git ls-remote origin refs/heads/main` on November 2. Branch: `codex/f02-remaining-descriptions-20261102`. Isolated clone: `.f02-remaining-descriptions-20261102`. Original `.f02-pilot-descriptions-20261101` remains preserved at `52268b7`.

Ownership preflight for the additional-description slice: `git fetch origin`, `git worktree list`, `git branch -vv`, `git status -sb`, and `gh pr list --repo abostwick12/lead-emergence-workspace --state open --json number,files`. Open PR #110 owns `sotf-experience.tsx`; #116 owns Connections; #58 owns retrieval; #44 owns MCP discovery. No open PR file list includes the three locked files changed by that slice: `components/sotf/workflow-descriptions.tsx`, `tests/e2e/sotf-workflow-descriptions.spec.ts`, and this evidence file. That slice changed no canonical document or shared shell; the separately approved dashboard-shortcut slice below adds the bounded shell change.

Canonical Phase 2/3 remains authorized with acceptance open. Repository-only implementation uses current source contracts; no production refresh or production operation was performed by this worker. Claim: the landing descriptions omit eight additional preparation modes. Falsifier: enumerate the existing MCP input modes and compare the main description surface. Result: the existing contract has thirteen modes; five overlap released workflow cards and eight lacked descriptions. The existing component and native disclosures can describe them without a registry, API, service, dependency, or runtime-tool import.

All new cards carry Pilot, Preparation mode, and Setup not checked labels. Their shared secondary metadata names the existing contract and mode and explicitly says there is no independent workflow version. Each explains input, access, output/retention, effects, limitations, and a supported next action. Sign-in, pilot access, authorization, entitlement, installation, discovery, health, and execution remain distinct; third-party connections stay in the client's ChatGPT account. All descriptions retain the protected-context restriction.

### Capability matrix for the eight modes

Owning sources: `lib/sotf/mcp.ts` (enum and read-only preparation handler), `lib/sotf/intelligence.ts` (preparation results), `lib/sotf/scheduling.ts` (availability checks and invitation command), `components/sotf/sotf-experience.tsx` (actual web controls), `components/sotf/schedule-conversation.tsx` (separate draft save), and `app/sotf/connect/page.tsx` (existing setup guide). These source paths were inspected at the stated base; none changed.

| Mode | Outcome/input | Existing next action | Output, effects, limitations |
|---|---|---|---|
| `coaching` | Agenda and changed decisions/commitments from saved work, optionally since a supplied date. | Existing saved-work anchor, Today, Prepare my SOTF session. | Web panel or ChatGPT response; no separate brief saved or automatic coach sharing/scheduling. Missing developments remain absent. |
| `networking` | Weekly people/relationship plan from saved people, history, and selected/latest week. | `/workspace/sotf/networking`; add/select a person and review next step. | Plan in Networking/ChatGPT. Separate confirmed changes save records. Preparation sends no outreach; planning is not contact. |
| `stories` | Relevant older or newer accomplishments from a supplied question and saved operational stories. | Saved-work anchor, Today, Find an example. | Panel/ChatGPT matches; no story rewrite/save/share. No match or missing evidence stays unresolved; no search of all ChatGPT history. |
| `interview` | Examples, practice questions, and gaps from an existing opportunity, interviewer context, and debriefs. | `/sotf/connect` plus an explicit resume/select-opportunity/interview-preparation prompt. If absent, review the role in Opportunities. | ChatGPT response; separate confirmed saves required. No application, contact, invented metrics, or invented employer feedback. |
| `offers` | Terms/criteria/tradeoffs and unresolved promises from saved offers and sources. | `/sotf/connect` plus explicit resume/compare-saved-offers prompt; record reviewed terms in Opportunities if missing. | ChatGPT response from Workspace records; no new comparison artifact, automatic winner, negotiation, acceptance, or employer contact. |
| `professional_work` | Manager/stakeholder/early-contribution preparation from recorded actual acceptance, role, promises, checkpoints. | `/sotf/connect` plus explicit resume/prepare-chapter-from-actual-acceptance prompt. | ChatGPT response; no automatic acceptance, status change, commitment, or scheduling. Without recorded acceptance the contract returns an instruction to compare and record the actual result first. |
| `scheduling` | Up to three proposals from offered/available/busy windows, recent check/source, time zone, duration, buffer. | Saved-work anchor, People, Find a time. | Dialog/ChatGPT proposal; preparation saves nothing. Separate web Save the draft for review retains an email draft. No automatic calendar read, send, reservation, or booking. Stale checks/no overlap require another check/window. |
| `invitation` | Reviewable text from an accepted agreed meeting linked to a person. | Saved-work anchor, People, Conversations, Prepare invitation draft; or explicit ChatGPT resume/prepare-invitation request. | ChatGPT preparation returns a draft command without saving. Web action separately saves an action draft. Web button also requires no debrief. Neither sends or creates an event; recipient/time/location need manual review. |

The saved-work anchor is intentional for scheduling and invitation: the dedicated Networking route uses a focused view that hides People navigation. No `/workspace/sotf/people` route or nonexistent section is invented. The setup guide remains the existing path; mode-specific prompts are included in the descriptions.

### Additional local validation

Dependencies: existing `node_modules` reused through a local junction after both package locks produced SHA-256 `64CF814C38D8434311F07E8EF22A89F8C85557DD2F85BA1BB215E3DBAA89643A`. No secret environment file copied. Process-local `TEMP` and `TMP` pointed to this clone's untracked `.task-temp` for Vitest.

- `npx playwright test tests/e2e/sotf-workflow-descriptions.spec.ts`, with `E2E_BASE_URL=http://127.0.0.1:9`: **9 passed, 1 intentional desktop touch skip**, 33.1 seconds. Desktop and Pixel 7 renders cover all fourteen cards, all required fields, accurate links and effects, unknown/setup/denied gates, keyboard open/close/focus/link navigation, and narrow touch without hover. No live server, account, or provider contacted. A source guard compares all thirteen contract enum values with the five released overlaps plus eight mode descriptions. Browser renders made no network requests and had no horizontal overflow.
- `npm run typecheck`: passed. `npm run lint`: passed. `git diff --check`: passed. Build readability/formatting checkpoint: PASS; existing card pattern retained and existing six cards untouched.
- `npm run check:boundaries`: passed, 108 runtime files and five environment tests.
- `npm run test:unit`: **391/391 tests passed**, 43 files, 26.16 seconds.
- `npm run test:schema`: **31/32 passed**. Pre-existing failure at `tests/schema-policy-contract.test.mjs:417` expects the old direct `return connectedSotfExperience()` shape. Current main awaits the helper before returning the description wrapper. `git diff 85760eac37d95ba8467ec4e51184eaa3cf767634 -- app/workspace/sotf/page.tsx tests/schema-policy-contract.test.mjs` is empty. Those files are outside locked scope and were not changed.
- `npm run build`: environment/tooling failure before compilation: Turbopack rejects the dependency junction because it points outside its configured filesystem root. `npm run build -- --webpack` then failed at sandbox-local `.next/static/chunks/next/dist/client` mkdir with EPERM. The same webpack command rerun outside the sandbox passed compilation, TypeScript, all 30 static pages, optimization, and trace collection (exit 0). It used only process-local synthetic public Supabase URL/key and localhost application URL, with no copied credentials. No build configuration changed. The default Turbopack command remains unproven in this dependency-junction setup; this is not a product-code repair or a claim that both bundlers passed.

Additional local screenshots: `test-results/f02-mode-{coaching,networking,stories,interview,offers,professional_work,scheduling,invitation}-mobile.png`, plus the existing full-page desktop/mobile open and keyboard screenshots. The supervisor inspected the interview and invitation mobile images; final review and commit identifiers belong in the supervisor's handoff.

Production/data impact: **None**. Acceptance remains **NOT TESTED**. The same separately authorized deployed-pilot observation described above must include all eight additional mode descriptions and their supported next actions, while denied access remains denied. Browser fixtures and source contracts do not establish tool execution or paid-client acceptance.

Historical backlog at the additional-description checkpoint included narrow dashboard navigation requiring three interactions; the local shortcut evidence below supersedes that navigation limitation. BACKLOG — NOT PART OF CURRENT TASK: full F02 closure, remaining hosted `transition.daily_brief` contract/tool availability, customer approval, real ChatGPT installation/discovery/execution, and running automation acceptance. The hosted contract is not represented as working or given a launch action. Existing automation declarations overlap workflow descriptions and prove no running schedule. The schema assertion drift is pre-existing and remains unfixed under the locked scope.

## Dashboard shortcut — November 2, 2026

IN SCOPE: add a direct, visible dashboard shortcut before the dashboard children in `components/workspace-shell.tsx`, plus focused tests and this evidence update. Existing fourteen descriptions, dashboard content/status calculations, CSS, routes, APIs, access rules, dependencies, and the shared checkout remain unchanged. Local starting commit: `59856b1e579565ce3a937c31cbd04a44dc03f9ce` on `codex/f02-remaining-descriptions-20261102`.

Canonical Phase 2/3 remains authorized with acceptance open. This is an isolated local implementation, with no production access or mutation by this worker. The source falsifier found the existing SOTF entry only inside the mobile sidebar; the dashboard main previously rendered only its children. The supported `/workspace/sotf` route already exists. The shortcut now uses that route, existing layout/button classes, and exactly `pathname === "/workspace" && sotfPilotEnabled && sotfAccess` after the existing shell authorization/setup returns. Its copy says SOTF pilot; it makes no connection-health or execution claim.

Ownership: the supervisor rechecked remote main with `git ls-remote origin refs/heads/main` and obtained `85760eac37d95ba8467ec4e51184eaa3cf767634`; its open-PR file-list check found no owner of these three files. The worker's own `git fetch origin` failed with a sandbox `getaddrinfo()` thread error, leaving the clone's remote-tracking ref stale; `git merge-base HEAD 85760eac37d95ba8467ec4e51184eaa3cf767634` returned that main SHA. Andrew explicitly approved the known same-file ownership overlap in the separate shared checkout. That checkout's uncommitted shell edit was preserved untouched.

Local evidence:

- `E2E_BASE_URL=http://127.0.0.1:9 npx playwright test tests/e2e/sotf-workflow-descriptions.spec.ts`: **13 passed, 1 intentional desktop touch skip**, 33.1 seconds. This includes the existing fourteen-card, keyboard/touch, contract and server-gate coverage plus the new shell tests.
- After a test-fixture UTF-8 declaration and explicit 390px mobile viewport were added, `npx playwright test tests/e2e/sotf-workflow-descriptions.spec.ts -g dashboard` with the same environment: **4 passed**, 16.7 seconds. Desktop Enter and mobile tap follow the visible shortcut to `/workspace/sotf` (interaction 1), then open the existing skill summary (interaction 2). The shortcut is in the initial viewport, at least 44px tall, and mobile navigation stays closed; no horizontal overflow occurs on either page.
- The shell test source-loads the actual `WorkspaceShell` with synthetic provider, navigation, clocks, capture-dialog and locked-state dependencies. The intercepted supported-route fixture renders the actual SOTF landing wrapper and descriptions with a synthetic authorized connected-experience result. Existing separate gate tests execute the real connected helper for allowed, disabled, signed-out, denied and failed/unknown cases. This is local browser evidence, not real authenticated server navigation or proof of current provider health.
- Thirteen visibility cases hide the shortcut: pilot off, SOTF denied, SOTF unknown, shell loading, signed out, missing workspace, workspace error, suspended access, unknown setup, incomplete setup, setup route, SOTF route, and another Workspace route.
- `npm run typecheck`, `npm run lint`, and `git diff --check`: passed after correcting one test-only `react/no-children-prop` lint finding. Build readability/formatting checkpoint: PASS; the shell change adds one conditional section and retains existing control flow.
- `npm run build -- --webpack`: passed compilation, TypeScript, all 30 static pages, optimization and trace collection (exit 0) on the changed shell. The sandbox attempt failed with mkdir EPERM at `.next/server/app/api/operator/bundles`; its approved outside-sandbox retry passed using only process-local synthetic public Supabase URL/key and localhost app URL. The known failing default Turbopack junction path was not rerun.

Screenshots (local, untracked): `test-results/f02-dashboard-shortcut-{desktop,mobile}.png` and `test-results/f02-dashboard-description-{desktop,mobile}.png`. Worker and supervisor inspected both dashboard screenshots; the 390px shortcut is readable and visible with the hamburger closed. Fixtures use only synthetic identity/content; no provider request or real account is used.

Prior committed boundary, 391-unit-test and schema 31/32 evidence above remains supporting evidence for unchanged paths; broad suites were not rerun. The pre-existing schema direct-return assertion remains outside scope. The default Turbopack dependency-junction limitation remains unchanged.

Production/data impact: **None**. Production acceptance for the dashboard shortcut remains **NOT TESTED**. After a separately authorized release, an authorized pilot user must reach a description from the real mobile dashboard in two interactions with the shortcut visible before opening navigation; pilot-off, denied/unknown and non-dashboard visibility must retain their existing boundaries. No push, PR, external review request, merge or deployment is authorized by this slice. Full F02 and broader customer acceptance remain open.
