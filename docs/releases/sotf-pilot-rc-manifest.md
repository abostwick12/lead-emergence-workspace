# SOTF pilot release-candidate manifest

## Release identity

- Workspace repository: `https://github.com/abostwick12/lead-emergence-workspace.git`
- Worktree: `C:\Users\awbostwick\Documents\ChatGPT\SOTF Pilot RC`
- Release branch: `release/sotf-pilot-rc`
- Published base: `origin/main` at `c4cfc1beb8b10cbecdc7c72bea447655928b4086`
- Reviewed source only: `origin/astra/sotf-indispensable` at `00691afdcd55006d9383eef120bc94f83eb31022`
- Entry landing branch remains separate in the Entry repository: `astra/lead-emergence-front-door`

The release branch was created directly from the published Workspace base. It does not contain the source branch as ancestry. The source branch was inspected as evidence and its relevant files were ported deliberately.

## Included source provenance

| Source commit or authored RC change | Included files | Reason | Destination release commit |
| --- | --- | --- | --- |
| `40d02c54828e4f45620d080cf19351a0608fd7d2` | `.env.example`; the six bounded bundle operator/claim APIs; `app/api/workspaces/[workspaceId]/bundles/[bundleKey]/route.ts`; bundle invite/operator pages and components; `lib/workspace/bundle-contract.ts`; `lib/workspace/bundle-server.ts`; `scripts/test-bundle-pilot-local.mjs`; `supabase/migrations/20260902162536_bundle_entitlement_foundation.sql`; `supabase/tests/database/bundle_entitlement_foundation.sql`; `tests/bundle-entitlements.test.ts`; required schema-test/package/runbook changes | Minimum generic bundle catalog, entitlement lookup, operator assignment, single-use invite issuance/claim/revocation, and local lifecycle proof. The migration was edited to exclude the adjacent Professional Context capability and all PC schema/runtime. | `df4cd4798125b3e30bec67eaa37fde47e7c6dd7e` |
| `c73aa22fea9a22a815c8fded628e15cbc802e132` | SOTF API; public connect/preview; Workspace SOTF route; `components/sotf/*`; `lib/sotf/{contracts,engine,intelligence,mcp,persistence,preview,server}.ts`; unavailable-only `lib/sotf/professional-context.ts` interface; operational migration/database test; SOTF unit/browser tests and product-status evidence | Reviewed opportunity, relationship, evidence, follow-through, persistence, native UI, and MCP product workflows. The PC-named file is only a stable unavailable interface: it performs no protected read, write, grant, or persistence. | `dde8f685e35572a3fc670d3d118771bb520e44db` |
| `00691afdcd55006d9383eef120bc94f83eb31022` | Scheduling component and library; connected synthetic harness; scheduling/channel-continuity tests; reviewed updates to the SOTF route/editor/contracts/engine/MCP/status evidence | Reviewed scheduling, invitation-draft controls, reload recovery, and bidirectional native/MCP continuity. | `dde8f685e35572a3fc670d3d118771bb520e44db` |
| RC-authored against current published main | `app/workspace/sotf/page.tsx`; `app/workspace/layout.tsx`; `components/{workspace-provider,workspace-shell,bundle-invite-claim}.tsx`; `app/api/mcp/route.ts`; `lib/workspace/mcp-server.ts`; `lib/workspace/repository.ts`; SOTF migration/database/unit/schema tests | Close the reviewed exposure gap: feature flag plus active exact-workspace `sotf_transition` entitlement now governs nav, direct route, MCP catalog, and operations. Unknown, malformed, expired, revoked, wrong-workspace, and lookup-error states fail closed. | `dde8f685e35572a3fc670d3d118771bb520e44db` |
| Selected test-fixture corrections first present in mixed `40d02c54828e4f45620d080cf19351a0608fd7d2` | `supabase/tests/database/{workspace_productization,lewis_workspace_parity,lewis_workspace_preference_parity}.sql`; SOTF test resource URI | Bring obsolete local pgTAP fixtures into the already-published `20260901150529_workspace_mcp_resource_admission` contract: UUID MCP client IDs, required resource grants, and canonical HTTPS MCP resource. These are test-only changes. | `fdced30af4122ad212ad2de4ca6fb6628f940a61` |
| RC-authored synthetic acceptance | `tests/sotf-workflows.test.ts` | One sequential first-fellow opportunity-to-follow-up proof for steps 2–13 and 15, including a reviewed practitioner result that changes the same opportunity from MAYBE to GO; the bundle lifecycle test proves step 1 and channel-continuity test proves step 14. | `394bfd5208915e36f8793fad25ce68558b1fa79b`, `c91d360c01009b8b97824967844212b5a8b037ae` |
| RC-authored security-gate maintenance | `scripts/scan-sensitive-data.mjs` | Preserve working-tree plus complete RC-lineage secret detection while batching unique Git blobs instead of repeatedly spawning per-file/per-commit processes. Only three exact, source-visible synthetic fixture sets are allowlisted; real key/token/credential patterns still fail. Excluded remote branch history is outside RC lineage and is audited separately in this manifest. | `0d5be7b82fad0f7698187a4209bae4f5b7d2b605` |
| RC dependency audit remediation | `package-lock.json` | Fresh production audit identified vulnerable transitive `fast-uri` and `qs` versions through the pinned MCP SDK. The lockfile-only compatible update resolves `fast-uri` to `3.1.7` and `qs` to `6.16.0`; direct dependency ranges and application APIs are unchanged. Fresh install, production audit, unit/MCP tests, typecheck, lint, boundaries, schema contracts, and build all pass afterward. | `73247e62c11e0bd18b597428322283723b3c504a` |

## Excluded source history

Every commit below was excluded from release ancestry. No commit range was cherry-picked.

| Source commit | Subject | Exclusion reason |
| --- | --- | --- |
| `a7a458aa3696fa9bce48133fe16778cdad863336` | define core and transition bundles | Superseded experimental Personal OS model; the RC uses only the later generic entitlement foundation. |
| `ff50ab50681bbcc5c1f1b52b866ac146de98524e` | add rhythm and memory promotion rules | Unpublished rhythm/promotion foundation is not required by the pilot. |
| `a149912c51ec545c4a3890d817dbe2e9537165c5` | cover bundles rhythm and memory guardrails | Tests only for excluded experimental foundation. |
| `2156da02d736c81b7f200985278b81c0397864f9` | label transition offer SOTF Bundle | Superseded presentation experiment. |
| `2f81d2c069eb704f0be3398d8484742df9649513` | define SOTF Bundle architecture and naming | Superseded Personal OS architecture, outside the operational pilot release. |
| `fe9029ccd968d99e31baf86e6903cdb484f96c11` | add SOTF Bundle rhythm page | Superseded rhythm UI. |
| `438675097c21dff17a01619516d03c5a973134c9` | add SOTF Bundle navigation | Globally exposed SOTF; replaced by entitlement-aware RC navigation. |
| `b57dd636f31f2eba8e8b46a40003d4c1f7b6336f` | lock SOTF Bundle label | Test for superseded UI. |
| `669cf95c75ee8be831e9726ed91ee20eb5e412aa` | model self-improvement loop | Unpublished self-improvement/P2-adjacent foundation; General P2 remains off. |
| `9f66a61943d226f048a9f0503cfe35d2c2f2105e` | include self-improvement skills | Excluded foundation. |
| `ea8626e4455a09f3d7ea380b99a771341c90d947` | expose self-improvement rhythms | Excluded foundation. |
| `22d6af5dbf122cd65dad3f42dd8e2d4e65d6a0ef` | cover self-improvement skills | Tests for excluded foundation. |
| `0587965d96ebc70ac8312060ab3a9c464121ece0` | define controlled self-improvement loop | Documentation for excluded foundation. |
| `71dd736025fd6fbae10f7c4fc8a8d24d1d3b1bca` | define AI-native progression pathway | Unpublished experimental pathway. |
| `2615d3ed5ef2b4261f7e43933a1b89ffbd7ab719` | make AI-native progression a bundle workflow | Unpublished experimental bundle workflow. |
| `06b95aa2f3cb74445a7584019b20080d1b2969a8` | protect AI-native progression contract | Tests for excluded experiment. |
| `eeb54b93bf435ace3a00810d30eb927be6bbb275` | show AI-native progression in bundle UI | UI for excluded experiment. |
| `63677d7be8dc7cd58fd06d9719ee4cbe7339dacc` | define AI-native apprenticeship objective | Documentation for excluded experiment. |
| `40d02c54828e4f45620d080cf19351a0608fd7d2` | checkpoint inherited Codex1 WIP | Mixed commit excluded as ancestry. Only the file-level bundle foundation and later-needed test fixtures listed above were ported. OAuth consent edits, MCP edits, rhythm, PC graph migration/runtime/tests/runbooks, RLS matrix changes, Lewis changes, and inherited evidence were excluded. |
| `8ec14e2975670637cb8a2ccaad94be1e26d4db1e` | merge origin/main into source branch | Historical merge, not release content. |
| `bacdd11d8d5d42a5c484ae75187572064992c965` | align synchronized baseline contracts | Mixed recovery synchronization excluded. |
| `c9ace25de446e91a01bb6d39174a3ce90f34ab89` | Harden Professional Context Phase A contracts | Protected PC workstream excluded. |
| `bddefa3d2345af9bac15769f68bd49ea5d54e86e` | add Professional Context confirmation authority | Protected PC workstream excluded. |
| `40a8f3d8714712693772a78899d2eab930ad7608` | harden Professional Context release contracts | Protected PC workstream excluded. |
| `f05a10ed5a80e892ccab9a52660796e49e72243f` | add Professional Context protected-read controls | Protected PC workstream excluded. |
| `72b4c070e6187ed8a89b0aadd626fea5571a2dd6` | make protected-read grant invalidation terminal | Protected PC workstream excluded. |
| `5b1664c7867896255b25550e6a9bf5937ab90577` | publish MCP review-candidate input schema | Unrelated unpublished MCP review work. |
| `d839796f0526b05f50d585aa55639b54bc3f1d90` | add R5E.8K PKCE acceptance harness | Unrelated auth/security harness. |
| `87511f90c1a36a70e978677f061e1d11172be2bf` | run pinned R5E.8K GoTrue gate | Unrelated auth/security harness. |
| `f2917a19b2a1c5fc611ac3e6896aeb07915346f8` | capture sanitized GoTrue startup diagnostics | Unrelated auth/security diagnostics. |
| `a18cf96bd1d837f85d7e34328be6bffa13e8ea28` | initialize local GoTrue auth schema | Unrelated auth/security harness. |
| `2ccd53202c9f82add9b1ff7a1da8f5c65680c2fc` | initialize Postgres auth schema via entrypoint | Unrelated auth/security harness. |
| `3f340b174d807fa45f9bb37275f4b4a4de6c81c1` | sign local fixture admin with ES256 | Unrelated auth/security harness. |
| `f2dd79b61cd5c6fd39ebb05f7b7aaeeb06a4236a` | capture GoTrue namespace diagnostics | Unrelated auth/security diagnostics. |
| `a3164bafdc4c1655736a22bdc41e1bd0c86124b3` | mirror local GoTrue namespace contract | Unrelated auth/security harness. |
| `aedd7764be7eb258d7bbbeeb6979ea8b2ee9d0da` | capture synthetic SMTP diagnostics | Unrelated auth/recovery harness. |
| `7942b9539db43d2f33d1174ed5cf3dda497734ce` | require TLS in synthetic SMTP sink | Unrelated auth/recovery harness. |
| `9ff7e3f62d643c8e2423a3beb3e43ad2dedc66e8` | diagnose GoTrue SMTP CA readability | Unrelated auth/recovery harness. |
| `f141a359a0124d50c454a2acd4f70516a727d5b3` | permit GoTrue to read synthetic SMTP CA | Unrelated auth/recovery harness. |

## Migration inventory

Published `origin/main` ends with `20260901150529_workspace_mcp_resource_admission.sql`. The RC adds exactly these migrations in verified source and local replay order:

1. `20260902162536_bundle_entitlement_foundation.sql`
2. `20260906120000_sotf_operational_workflows.sql`

The first adds generic catalog, capability mapping, hashed single-use invites, entitlement history, bounded operator commands, and resolution helpers. The second adds ordinary SOTF event persistence and entitlement-aware SOTF discovery/operation guards. Neither adds protected-PC schema, protected-PC grants, General P2, service-role application access, or external provider execution.

## Boundary result

The Workspace RC diff contains no Entry login, Workspace login, auth callback, product handoff, session-cookie, OAuth consent, or identity-owner modification. `app/api/mcp/route.ts` changes only post-authenticated SOTF catalog admission. `lib/sotf/professional-context.ts` is an unavailable-only interface and adapter; no PC migration, table, capability row, grant, MCP tool, read, write, or persistence implementation is present. Paul Blart was not touched.
