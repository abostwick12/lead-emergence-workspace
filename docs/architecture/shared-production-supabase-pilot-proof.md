# Shared-production Supabase pilot proof

Date: 2026-09-13  
Workstream: Supa  
Scope: read-only repository inspection and isolated local proof only  
Workspace evidence ref: `cbdb066931799d8f5b631021ce14621099221693`  
Ministry evidence ref: `origin/main@c96537b49a46bab50efeded1ae5c4aa2ad5632a4`  
Consulting evidence ref: `origin/main@0dfa14d9a339897f6a1ada83a3faf3240f519223`

## Executive decision

**B — SHARED PRODUCTION PILOT VIABLE WITH BOUNDED HARDENING**

The accepted architecture permits Ministry, Consulting, Personal Workspace, and
SOTF to coexist in the existing Ministry production Supabase project while Entry
production remains separate. A separate Personal production project is a
**proposed blast-radius optimization**, not an accepted security or correctness
requirement.

The schema boundary is credible: the combined local database accepted all 19
current Workspace migrations over the Consulting schema set without object
collisions, every audited product table had RLS enabled, authenticated roles had
no direct private-table grants, and 631 of 631 transactional assertions passed.
Ordinary Ministry, Consulting, and Workspace browser claims were unchanged by
the Workspace access-token hook.

The topology is not ready to migrate yet. Four bounded blockers remain:

1. the Workspace hook can convert an OAuth token for the wrong resource/audience
   into a Workspace-authorized token when the same user/client has an active
   Workspace resource grant;
2. Ministry and Consulting MCP verifiers are not yet fail-closed on exact product
   resource, audience, approved client, and session class;
3. Consulting runtime uses `SUPABASE_SECRET_KEY` for general data paths, contrary
   to the pilot's no-runtime-`service_role` rule; and
4. Ministry `origin/main` does not presently provide one deterministic, complete,
   target-locked shared-production migration replay and ledger for the combined
   committed lineage.

These are shared-control-plane and release-governance repairs. Buying a separate
Personal project would reduce some blast radius, but it would not repair the
current token verifiers, Consulting privileged runtime paths, or the
Ministry/Consulting shared-project risks that already exist.

No hosted project was inspected through mutation, linked, migrated, configured,
resumed, or deployed. No OAuth client or secret was changed. No SOTF repair was
made.

## 1. Architecture-decision chronology

| Order | Source | Classification | What it establishes |
|---|---|---|---|
| 1 | `ADR-0001-standalone-workspace-repository.md` | ACCEPTED | Workspace is an independent repository and application deployment. Repository separation does not require database-project separation. |
| 2 | `ADR-0002-temporary-shared-supabase-project.md` | ACCEPTED | The initial extraction uses the Ministry hosted project with separate schemas, RLS, grants, and storage paths. |
| 3 | `ADR-0003-workspace-tenancy-model.md` | ACCEPTED | Personal data remains keyed by `workspace_id`; a personal Workspace is the tenant boundary. |
| 4 | `ADR-0004-shared-auth-boundary.md` | ACCEPTED | `auth.users` is the only shared identity primitive. A user identity does not itself grant Ministry, Consulting, or Workspace product authority. |
| 5 | `ADR-0005-hosted-migration-authority.md` | ACCEPTED | Workspace authors source migrations; Ministry packages, reviews, applies, and records shared-hosted migrations. |
| 6 | `ADR-0007-runtime-service-role-prohibition.md` | ACCEPTED | Workspace application runtime may not use a service-role-equivalent credential. |
| 7 | `ADR-0010-future-supabase-project-separation.md` and `future-supabase-separation.md` | ACCEPTED | A later split is a configuration/data-migration project triggered by scale, external tenancy, compliance, recovery, or operational need—not an extraction prerequisite. |
| 8 | `ADR-0011-production-supabase-allocation.md` | PROPOSED | A dedicated Personal production project is recommended primarily for reduced blast radius. Its status is explicitly “PROPOSED — awaiting explicit infrastructure and data-disposition approval.” |
| 9 | `docs/runbooks/production-project-separation.md` | OPERATIONAL RUNBOOK | Describes how to perform a dedicated-project cutover, but treats the unapproved ADR-0011 destination as fixed. It is not decision authority by itself. |
| 10 | `docs/status/extraction-status.md` | OPERATIONAL RUNBOOK | Records both the unapproved dedicated-project proposal and the later user-selected path to package the Workspace/MCP foundation for shared production `cirqqhuvzekbvysiyedg` under Ministry authority. |
| 11 | Consulting `ADR-0002-consulting-tenancy-schema-and-migrations.md` | ACCEPTED, WITH STALE CLAUSE | Accepts Ministry and Consulting in one hosted project with product-local schemas and authority. Its statement that Personal “remains” separate imports ADR-0011 as if approved. |
| 12 | Consulting `TARGET-TOPOLOGY-MIGRATION-PLAN.md` | HISTORICAL | Captures a dedicated-Personal target from the proposal era; it does not supersede Workspace decision authority. |
| 13 | `lewis-consumer-mcp-readiness.md` | AMBIGUOUS | Correctly gates live OAuth/MCP acceptance, but its Entry-development/shared-foundation cutover language does not cleanly distinguish identity authority from the Ministry shared data plane. |

The chronology is therefore:

```text
accepted shared production with product-local schemas
→ repository/application extraction under Ministry migration authority
→ proposed dedicated Personal production for blast-radius reduction
→ proposal-dependent separation runbook
→ later operational selection of the Ministry shared project for Workspace/MCP
```

### Direct answer

A separate Personal production Supabase project is **not an accepted architecture
requirement**. It is a **proposed blast-radius optimization** and recommended
future hardening option. The separation runbook and the identified Consulting
topology statements incorrectly promote that proposal to a mandatory condition.

## 2. Current authoritative production topology

Subject to the blockers and gates in this report, the authoritative pilot target
is:

```text
ENTRY PRODUCTION (separate)
└── identity and eligibility authority

MINISTRY SHARED PRODUCTION SUPABASE: cirqqhuvzekbvysiyedg
├── auth.users and project-wide Auth configuration
├── Ministry-owned public data and functions
├── consulting_os
├── consulting_private
├── consulting_security
├── workspace
└── workspace_private
    └── Personal and SOTF durable state, private controls, and MCP admission data

INDEPENDENT APPLICATION DEPLOYMENTS
├── ministry.leademergence.com
├── consulting.leademergence.com
└── workspace.leademergence.com
```

This is a target decision, not a claim that all listed Workspace/SOTF migrations
or OAuth settings are currently deployed there. `docs/status/extraction-status.md`
contains historical hosted and sandbox observations; the current source lineage
and production state must be re-established by preflight before any authorized
package is prepared.

Entry determines identity/eligibility. Each product independently determines
membership, entitlement, capability, row access, and allowed actions. Sharing
`auth.users` must never collapse those decisions.

## 3. Ministry migration-authority evidence

The accepted flow is already documented and has historical implementation:

```text
Workspace authors an immutable source migration
→ Ministry imports it into a target-locked package
→ package records source repository, commit, filename, and checksum
→ Ministry preflight confirms project ref and current ledger
→ Ministry applies the ordered package
→ Ministry postflight and product regressions verify it
→ Ministry records the applied ledger/checksum and recovery evidence
```

Evidence includes:

- Workspace `ADR-0005-hosted-migration-authority.md` and
  `docs/runbooks/shared-supabase-migrations.md`;
- Ministry `docs/architecture/gate-d-workspace-cutover.md`;
- Ministry `supabase/migrations/20260821190000_workspace_clock_preferences.sql`,
  which records Workspace source provenance and requires the Ministry-owned
  hosted path;
- current target-locked packages under Ministry
  `supabase/hosted-packages/`; and
- Ministry `scripts/verify-durable-mcp-packages.mjs` plus package preflight,
  postflight, and evidence documents.

Historical package commits that are not ancestors of current Ministry
`origin/main` remain useful provenance, not current release inputs:

- `8b13cf7` — Workspace foundation/Gate-A package;
- `143943c` — shared-production Workspace foundation through Lewis phase 0; and
- `8cc0f35` — Entry-development Workspace bootstrap rehearsal.

No package from an unmerged or stale commit may be applied directly. It must be
recreated from the selected immutable source lineage and verified again.

## 4. Existing Workspace packages in current Ministry `origin/main`

| Package | Current target | Scope/status |
|---|---|---|
| `workspace-integration-vault` | package-specific shared target | Integration-vault package and evidence; revalidate source checksum and target before reuse. |
| `workspace-trusted-oidc-provisioning-boundary-vnj` | `vnjdubrnmxvmsccxmhst` | Entry-development target locked; must not be retargeted to Ministry production. |
| `workspace-mcp-resource-admission-vnj` | `vnjdubrnmxvmsccxmhst` | Entry-development target locked; rehearsal evidence only. |
| `workspace-client-admission-controls-vnj` | `vnjdubrnmxvmsccxmhst` | Entry-development target locked; rehearsal evidence only. |
| `entry-operator-client-admission-vnj` | `vnjdubrnmxvmsccxmhst` | Entry-development authority package; outside this pilot data-plane change. |

Only `20260901150529_workspace_mcp_resource_admission.sql` was found byte-exact
in both Workspace and the corresponding current Ministry root/package copy.
Clock-preference and integration-vault history use Ministry provenance headers or
different target timestamps and therefore require source-checksum comparison,
not filename equivalence.

Current Workspace migrations not represented as a complete current-main
shared-production package include foundation/Gate A, productization, capture,
private RLS/advisor changes, OAuth session/resource changes, Lewis phases,
bundle entitlement, and SOTF operational migrations. Historical branches cover
some of that range but are not current authority.

## 5. Shared schema topology and ownership

The isolated combined database produced this inventory after applying the 19
Workspace migrations to a Consulting product-schema baseline:

| Schema | Product owner | Relation inventory | RLS | Runtime direct-table posture |
|---|---|---:|---:|---|
| `public` | Ministry/platform | Representative Ministry identity and permission surfaces tested; a full clean Ministry replay was not possible from current committed migrations | policy-specific | product membership required; Workspace identity alone returned no Ministry rows |
| `consulting_os` | Consulting | 128 tables | 128 enabled | product membership/organization policies |
| `consulting_private` | Consulting | 8 tables | 8 enabled | no `authenticated` table grants; schema usage denied |
| `consulting_security` | Consulting | 3 tables | 3 enabled | no direct table grants; only named helper-function execution where granted |
| `workspace` | Workspace/SOTF | 33 tables | 33 enabled | direct browser session plus workspace membership/entitlement/capability policies |
| `workspace_private` | Workspace/SOTF | 12 tables | 12 enabled | no `authenticated` table grants; schema usage denied; named controlled functions only |

All audited product schemas and tables were owned by `postgres`; `public` used
the database owner. Physical ownership is therefore not the product boundary.
Schemas, grants, RLS, fail-closed helper functions, and application verifiers are
the boundary.

Tenant-key inventory found `workspace_id` on 26 `workspace` tables and six
`workspace_private` tables. Consulting uses `organization_id` throughout its
tenant-bearing surfaces (152 audited columns across tables/views), with seven in
`consulting_private`. The products do not share a tenant key or product role.

The Workspace schema references Ministry only in Gate-A hardening for the
existing `public.current_ministry_id()` boundary. Consulting migrations contained
no Workspace-schema data dependency. No application imports another product's
runtime code or tokens.

## 6. RLS, grants, entitlements, capabilities, and privilege

### Workspace

- `auth.uid()` establishes identity only.
- active Workspace membership establishes tenant authority;
- Entry eligibility and Workspace plan status are distinct gates;
- named capabilities, including `workspace_mcp` and SOTF flags, gate privileged
  workflows;
- current membership helpers require a direct browser session for base-table
  access, so a Workspace MCP bearer cannot select base tables merely by owning
  the same `auth.uid()`;
- MCP calls use controlled RPCs whose security-definer bodies independently
  re-check the MCP session, membership, plan, and capability; and
- `workspace_private` has RLS and no browser-role table grants.

### Consulting

- tenant access is based on Consulting portal identity and organization/client
  membership, not existence in `auth.users`;
- `consulting_private` and `consulting_security` tables are not generally exposed
  to `authenticated`; and
- normal RLS isolation remained green after Workspace was added.

However, Consulting `origin/main:lib/supabase/admin.ts` creates a general client
with `SUPABASE_SECRET_KEY`. It is imported by auth handoff, Entry SSO, access and
invitation repositories, assessment administration, participant-link, and MCP
audit paths. Supabase documents that a secret key authorizes the `service_role`
Postgres role and bypasses RLS. This is runtime privileged access, not merely a
migration operation, and violates the pilot assumption. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
and [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

### Ministry

The tested `current_ministry_id()` semantics require an actual Ministry profile;
a Workspace-only or Consulting-only `auth.uid()` resolves to no Ministry tenant.
The relevant cross-product negative test passed. A complete current-main Ministry
fresh replay remains a gate because its committed migration directory is not a
self-contained baseline.

### Privileged behavior classification

| Behavior | Allowed for pilot? | Reason |
|---|---|---|
| Ministry-owned migration runner with reviewed credentials | Yes, only after written gate approval | Deployment-only authority with immutable package, target lock, and ledger. |
| Named `SECURITY DEFINER` RPC with fixed `search_path`, revoked defaults, narrow execute grants, and internal authorization | Yes | Capability boundary can be audited and transactionally tested. |
| Workspace application runtime service/secret key | No | Prohibited by accepted ADR and unnecessary for normal product access. |
| Consulting general runtime secret-key data client | No | Bypasses RLS and expands a compromised application into a project-wide data compromise. |

## 7. Auth and OAuth flow inventory

Supabase Auth and its custom access-token hook are project-wide. The hook runs
before token issuance, including OAuth and refresh flows; this makes the hook a
shared control-plane component. Supabase's hook behavior is documented at
[Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook).

| Session class | Issuer/subject | Required binding | Intended claims and reachability |
|---|---|---|---|
| Ministry browser | shared Supabase issuer / `auth.users.id` | Ministry profile/session | ordinary `authenticated` audience; no Workspace MCP claim; Ministry RLS only |
| Ministry MCP/OAuth | same | exact Ministry MCP resource, audience, active approved client, and Ministry authority | Ministry MCP only; no Workspace/Consulting authority |
| Consulting browser | same | Consulting portal session and organization/client membership | ordinary claims; Consulting RLS only |
| Consulting OAuth | same | exact Consulting MCP resource/audience, active approved client, and Consulting membership | Consulting MCP only |
| Workspace browser | same | direct session, Workspace membership, Entry eligibility, plan/capabilities | ordinary claims; Workspace base-table/RPC surface only |
| Workspace ChatGPT/Claude MCP | same | exact Workspace resource, exact audience, active registered client/resource grant, Workspace membership, plan, capability | `client_id`, exact `aud`, `resource`, `workspace_mcp=true`; controlled Workspace MCP RPCs only |
| Unknown/malformed OAuth | same or invalid | none | no product MCP authority; reject malformed/unknown client |
| Revoked Workspace OAuth | same | revoked grant/client | no `workspace_mcp`; endpoint and RPC denial |
| Wrong audience/resource | same | mismatch | no claim conversion; endpoint denial |

## 8. Access-token-hook analysis

The latest Workspace definition is
`20260901150529_workspace_mcp_resource_admission.sql:454-516`.

It is materially safer than older definitions: it does **not** treat the mere
presence of any OAuth `client_id` as sufficient. It finds an active
`workspace_private.mcp_oauth_resource_grants` row for the same user, client, and
canonical Workspace resource. Without that row it removes `workspace_mcp`.

It is still not safe enough for shared production:

- it does not require the token's incoming `resource` to equal the Workspace
  resource;
- it does not require the incoming `aud` to be compatible with Workspace;
- it overwrites `aud` with the Workspace resource whenever the stored grant is
  active;
- it does not preserve or normalize `resource` to the same verified value; and
- at token time it does not re-check that `auth.oauth_clients` still contains an
  active, non-deleted approved client.

The local proof created an active Workspace grant, then evaluated the hook with a
Consulting resource/audience. The hook rewrote `aud` to the Workspace resource,
left the Consulting `resource` claim intact, added `workspace_mcp=true`, and made
`workspace_private.is_valid_mcp_request()` return true. The same proof removed
the client from the synthetic client catalog; the active resource grant still
caused authorization. Revoking the resource grant correctly removed
`workspace_mcp`.

Workspace `lib/workspace/mcp-auth.ts` checks subject, expiry through `getUser`,
exact Workspace `aud`, `workspace_mcp=true`, and `client_id`, but does not check
the `resource` claim. The database MCP guard also checks the grant, client claim,
marker, and audience, but not the token resource or current OAuth-client liveness.

### Direct answers

- **Does the hook treat any `client_id` as Workspace authority?** No. An active
  Workspace user/client/resource grant is also required.
- **Is it fail-closed on exact token resource, audience, approved client, and
  current registration?** No. The demonstrated wrong-resource conversion and
  orphan-grant behavior are production blockers.
- **Could an unknown future Ministry/Consulting client receive Workspace claims?**
  A truly unknown client with no Workspace grant does not. A reused, stale, or
  multi-resource client with an active Workspace grant can. That ambiguity is a
  blocker in a project-wide hook.

## 9. Auth noninterference results

Direct before/after hook comparisons in the isolated database passed:

| Case | Result |
|---|---|
| Ministry normal session | claims byte-equivalent after hook evaluation |
| Consulting normal session | claims byte-equivalent after hook evaluation |
| Workspace browser session | claims byte-equivalent after hook evaluation |
| Valid Workspace grant | required `client_id`, Workspace `aud`, and `workspace_mcp=true` produced |
| Unknown client with no grant | no Workspace MCP claim |
| Revoked Workspace grant | Workspace MCP claim removed |
| Wrong resource with active grant | **failed closed-boundary expectation: admitted after audience rewrite** |
| Wrong audience with active grant | **failed closed-boundary expectation: audience rewritten and admitted** |

Ordinary-session noninterference is proven for the tested claims. OAuth
cross-resource noninterference is not proven and is an exact blocker.

## 10. Cross-product isolation results

The isolated proof used synthetic Ministry, Consulting, Workspace, Workspace+SOTF,
Workspace MCP, wrong-tenant, missing-plan/capability, revoked, and unknown-client
contexts. Every test ran in a transaction and rolled back.

| Assertion | Result |
|---|---|
| Ministry user cannot read `workspace_private` | PASS — no schema/table authority |
| Consulting user cannot read `workspace_private` | PASS — no schema/table authority |
| Workspace-only user cannot read Ministry protected rows | PASS — `current_ministry_id()` returned null and representative policies returned zero rows |
| Workspace user cannot read Consulting private data | PASS — no schema/table authority |
| Workspace MCP bearer cannot select Workspace base tables | PASS — direct-session membership helper denies it |
| Valid Workspace MCP can reach approved controlled RPCs | PASS |
| Wrong Workspace membership / cross-tenant ID | PASS — denied |
| Missing or revoked entitlement | PASS — denied |
| Missing capability / release gate off | PASS — denied |
| Unknown OAuth client obtains Workspace MCP authority | PASS when no grant exists |
| Wrong resource/audience with an active Workspace grant | **FAIL — hook converts it to Workspace authority** |

Representative identity counts were also correct: the Ministry identity saw one
Ministry row and no Workspace row; the Consulting identity saw neither Ministry
nor Workspace rows; the Workspace identity saw one Workspace row, no Ministry
row, no Consulting row, and no Ministry guest permission.

No tested principal obtained privilege merely because the products shared one
database. The exception is claim conversion in the shared Auth hook, which is a
project-wide authorization defect rather than a schema/RLS collision.

## 11. OAuth coexistence matrix

“Intended” describes the required pilot contract. **BLOCKER** marks current
behavior that does not meet it.

| Session | Hook runs? | Token modified? | Expected client binding | Expected audience | Expected resource | Ministry access | Consulting access | Workspace access | `workspace_private` | MCP RPC access | Expected denial behavior |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ministry browser | Yes | No | none | `authenticated` | none | profile/RLS | only if separately a member | only if separately eligible/member | No | None | no membership returns zero/denial |
| Ministry MCP/OAuth | Yes | No Workspace claims | exact live Ministry client | exact Ministry MCP | exact Ministry MCP | controlled MCP | No | No base/MCP | No | Ministry only | wrong/missing resource, audience, client, or authority → 401 |
| Consulting browser | Yes | No | none | `authenticated` | none | only if separately a Ministry user | membership/RLS | only if separately eligible/member | No | None | no membership returns zero/denial |
| Consulting OAuth | Yes | No Workspace claims | exact live Consulting client | exact Consulting MCP | exact Consulting MCP | No | controlled MCP | No base/MCP | No | Consulting only | **BLOCKER:** current verifier accepts missing resource and does not enforce audience/approved client |
| Workspace browser | Yes | No | none | `authenticated` | none | only if separately a Ministry user | only if separately a Consulting member | membership/plan/capability | No | browser RPCs only | OAuth-only/base-private paths denied |
| Workspace ChatGPT MCP | Yes | Yes | live client + active exact resource grant | exact Workspace MCP | exact Workspace MCP | No | No | controlled MCP only, not base tables | No direct access | Workspace allowlist | **BLOCKER:** current hook/verifier omit exact incoming resource and client-liveness checks |
| unknown OAuth client | Yes | No Workspace claims | none | unchanged | unchanged | No MCP | No MCP | No MCP | No | None | **BLOCKER:** Ministry/Consulting verifiers need explicit unknown-client rejection |
| revoked OAuth client | Yes | claim removed | revoked client/grant | unchanged/non-Workspace | unchanged | No MCP | No MCP | No MCP | No | None | grant/client revocation must fail at issuance, endpoint, and RPC |
| wrong resource | Yes | Must not modify | mismatch | unchanged | wrong | No | No | No | No | None | **CURRENT BLOCKER:** active Workspace grant causes conversion/admission |
| wrong audience | Yes | Must not modify | mismatch | wrong | asserted resource | No | No | No | No | None | **CURRENT BLOCKER:** active Workspace grant causes rewrite/admission |

Static verifier inspection found two additional ambiguities:

- Ministry `lib/meridian/mcp/auth.ts` accepts an ordinary valid non-guest token;
  `client_id` and resource may be absent, and default scopes are supplied.
- Consulting `lib/mcp/auth.ts` requires a `client_id`, but accepts a missing
  resource and does not enforce an exact audience or current approved
  client/resource grant.

Both must be product-bound before a shared-project pilot. Central Ministry and
Consulting membership helpers should also reject a `workspace_mcp` session class
so a dual-product user cannot replay the token against exposed REST schemas.

## 12. Workspace and SOTF migration compatibility

The current Workspace branch contains 19 ordered migrations ending with
`20260906120000_sotf_operational_workflows.sql`. The independent active SOTF
repair lineage subsequently adds, in order:

1. `20260911143000_sotf_v1_daily_brief_slice.sql`;
2. `20260912162000_sotf_v1_outcome_semantic_parity.sql`;
3. `20260912190000_sotf_v1_unicode_truncation_parity.sql`; and
4. `20260913110000_sotf_v1_canonical_ordering_parity.sql`.

Those files were inspected only as migration-lineage evidence. They were not
modified, packaged, or treated as accepted product behavior.

### Compatibility results

- all 19 current Workspace migrations applied over the isolated Consulting
  product-schema baseline;
- no schema, table, function-signature, RPC, grant, or extension name collision
  was observed between the Consulting and Workspace lineages;
- all 33 Workspace and 12 Workspace-private tables had RLS enabled;
- Workspace uses `pgcrypto`; Ministry additionally uses `vector`; no extension
  conflict was identified; and
- Workspace's custom access-token hook is the material project-wide configuration
  collision/failure domain.

Migration filename/timestamp collisions were not found across the selected
Workspace/SOTF lineage and the other products. Ministry `origin/main` itself has
duplicate migration version prefixes `023`, `030`, and `031`, and its committed
migration directory starts after the initial platform schema. Therefore a clean,
deterministic full Ministry+Consulting+Workspace replay cannot yet be produced
from current committed directories alone. That is a packaging/reproducibility
blocker, not evidence of a schema collision or need for a separate project.

## 13. Local proof ledger

| Proof group | Assertions | Result |
|---|---:|---|
| Workspace hostile RLS | 25 | PASS |
| Workspace productization | 70 | PASS |
| Workspace product events | 5 | PASS |
| Lewis parity | 31 | PASS |
| Lewis connector gates | 27 | PASS |
| Lewis preference parity | 20 | PASS |
| Bundle entitlement | 58 | PASS |
| SOTF operational schema | 34 | PASS |
| Consulting 17 database suites | 361 | PASS |
| **Total transactional assertions** | **631** | **PASS** |

The combined test database was a local Consulting product-schema baseline cloned
inside an existing local Supabase PostgreSQL container, plus the current
Workspace migration lineage and representative Ministry boundary objects. The
platform-shell clone emitted 31 expected warnings around Supabase-managed roles,
default privileges, Realtime, and Vault, while product schemas and synthetic Auth
users were available for the tests. It was not a substitute for the still-required
clean Ministry production-shaped replay.

### Workspace repository verification

| Required check | Result |
|---|---|
| `npm run check:boundaries` | PASS — 83 runtime files; no Ministry/Consulting imports or Workspace runtime service-role client |
| `npm run test:schema` | PASS — 31/31 |
| `npm run typecheck` | PASS |
| `npm run test:unit` | PASS — 17 files, 100/100 tests |
| `npm run build` | PASS — production build and 27-page generation completed |
| `npm run lint` | UNAVAILABLE AS A CLEAN REPOSITORY SIGNAL — it traversed generated `.next` files under `.sotf-local/canonical-ordering-parity-repair` and `.sotf-local/unicode-truncation-parity-repair`, producing 40 generated-code errors and six warnings. Those paths belong to the explicitly excluded active SOTF repair workstream and were not changed here. The bounded rerun `npm run lint -- --ignore-pattern .sotf-local` passed. |

The lint limitation is recorded here, rather than by editing the shared testing
ledger, because this workstream is authorized to create only this proof document
and must not alter active SOTF evidence.

## 14. Required migration packaging path

Before any hosted write, create one new immutable Ministry-owned package for
`cirqqhuvzekbvysiyedg` that:

1. pins Workspace and accepted SOTF source commits;
2. copies every required migration in one explicit order without relying on
   historical branch packages;
3. records source and packaged SHA-256 checksums;
4. resolves Ministry duplicate-prefix and missing-baseline ambiguity through a
   canonical manifest/ledger rather than renaming previously applied history;
5. verifies exact project ref, database identity, expected current ledger,
   required schemas/extensions, and absence/presence of every predecessor;
6. performs a clean shared-project replay followed by all three product
   regressions and the independent token/isolation oracle;
7. includes forward-only recovery and application rollback procedures; and
8. remains unapplied until the written production migration gate is approved.

Package Entry/OIDC changes separately. Do not reuse or retarget a `-vnj` package.

## 15. Blast-radius comparison

| Dimension | Entry separate + Ministry shared data plane | Dedicated Personal project | Practical pilot judgment |
|---|---|---|---|
| Auth blast radius | Ministry, Consulting, and Workspace share issuer, hook, signing/configuration | Workspace Auth/hook separated; Ministry+Consulting remain shared | Dedicated reduces Workspace coupling, but exact session-class hardening is still required everywhere. |
| Migration blast radius | Bad privileged migration can affect the shared database | Personal migrations isolated | Target lock, review, transactionality, backup, and regression gates are adequate for a small pilot. |
| Outage/resource blast radius | One database outage or exhaustion affects three apps | Workspace isolated from Ministry/Consulting outage | Meaningful resilience benefit; not a correctness prerequisite for limited pilot users. |
| Database compromise | Project-level credential/owner compromise can reach all schemas | Personal data separated | Strong benefit, but current Consulting secret key must be removed either way. |
| JWT/config compromise | Shared issuer/configuration can affect all products | Workspace signing/config isolated | Benefit; exact audience/resource enforcement remains necessary even when separate. |
| Schema/RLS isolation | Proven compatible locally; private schemas ungranted | Additional physical barrier | Current logical isolation is sufficient only after shared-token blockers close. |
| Operations | One authority, backup, ledger, and capacity pool | More projects, secrets, environments, federation, monitoring, and recovery paths | Shared is materially simpler and faster for the pilot. |
| Migration/rollback | Coordinated regression and recovery across products | Product-local changes but cross-project identity/data migration | Shared requires stricter gates; dedicated introduces migration/federation complexity. |
| Cost/pilot speed | Reuses existing capacity; bounded packaging work | New infrastructure and cutover work | Shared wins until measured scale/reliability need justifies separation. |

Dedicated Personal production is classified as **RECOMMENDED FUTURE HARDENING**.
Triggers should include external/organization tenancy, materially different
compliance or recovery objectives, sustained resource contention, a need for
independent Auth change cadence, or unacceptable measured shared outage risk.

## 16. Failure-domain analysis

| Failure domain | Likelihood | Impact | Existing mitigation | Additional pilot mitigation | Does separate Personal remove it? |
|---|---|---|---|---|---|
| Auth hook failure | Medium | High, token issuance/claims across shared products | fail-closed SQL, local tests, Ministry migration authority | exact resource/audience/client liveness; ordinary-session differential tests; kill-switch/rollback | Removes Workspace hook impact from Ministry/Consulting, but not hook correctness |
| Bad migration | Medium | High | reviewed Ministry authority, forward migrations, RLS tests | immutable combined manifest, clean replay, backup, product regressions, transaction/rollback plan | Removes Personal migration impact on others; bad Personal migration remains |
| Supabase outage | Low/medium | High availability impact | platform operations and app failure states | recovery objectives, status monitoring, synthetic probes, tested runbook | Reduces correlated outage; does not remove provider/region outages |
| Project-wide Auth configuration | Medium | High | documented Auth boundary | configuration snapshot/diff, redirect/provider allowlist, staged acceptance | Separates Workspace config; Ministry+Consulting still coupled |
| JWT signing/configuration | Low | Critical | issuer and subject validation | exact audience/resource/session-class validation and rotation drill | Reduces cross-product impact, not token-validation defects |
| Database resource exhaustion | Medium | Medium/high | shared platform quotas | baseline, query budgets, alerts, statement timeouts, release gates, capacity trigger | Removes Workspace load from shared pool; not other load/outage risk |
| Shared extensions | Low | Medium | schema-qualified migrations and reviewed extensions | extension/version inventory in preflight | Separates Workspace extension changes only |
| Shared secrets/configuration | Medium | Critical | environment separation and no Workspace runtime secret | remove Consulting runtime secret client; secret inventory/rotation | Reduces scope of Personal secrets; does not fix Consulting risk |
| Incorrect/malicious `SECURITY DEFINER` | Medium | Critical | fixed search paths, revoked defaults, internal checks, pgTAP | inventory all definers/owners/grants; adversarial cross-product oracle | Limits damage to Personal project if separated; function still unsafe there |
| Accidental cross-schema grants | Medium | High | separate schemas, explicit grants, RLS | grant-diff pre/postflight and negative tests for every app role | Physical split removes direct cross-project grants, not same-product grant errors |

## 17. Exact blockers

1. **Workspace token-resource binding:** wrong `resource`/`aud` plus an active
   Workspace grant is converted into Workspace MCP authority.
2. **MCP verifier ambiguity:** Ministry accepts browser/no-resource tokens;
   Consulting accepts missing-resource tokens and lacks exact audience and
   approved-client enforcement.
3. **Cross-schema replay for dual-authorized users:** central Ministry and
   Consulting RLS/session helpers are not explicitly bound against the
   `workspace_mcp` token class.
4. **Consulting runtime privileged client:** `SUPABASE_SECRET_KEY` is used by
   general runtime data paths and is service-role-equivalent for database access.
5. **No current complete shared replay artifact:** current Ministry `origin/main`
   lacks a self-contained canonical baseline/manifest and complete current
   Workspace/SOTF package for the target.
6. **Production proof still absent:** local evidence is not hosted preflight,
   migration authorization, live OAuth acceptance, backup proof, or SOTF product
   acceptance.

## 18. Narrowly required hardening

The smallest safe repair is a bounded **shared-project OAuth session-class and
release-manifest hardening** slice:

1. change the project-wide hook so it stamps Workspace claims only when the
   incoming authorization is for the exact Workspace resource/audience, the
   OAuth client currently exists and is active, and the exact user/client/resource
   grant is active; preserve ordinary and other-product claims rather than
   rewriting mismatches;
2. require exact `resource`, `aud`, current client, session marker, membership,
   entitlement, and capability in the Workspace endpoint and database guard;
3. bind Ministry and Consulting MCP verifiers to their exact resource/audience,
   approved client, and intended session class; reject missing claims;
4. make central Ministry and Consulting data-authority helpers reject a
   Workspace MCP session for non-Workspace schemas, including dual-role users;
5. replace Consulting general secret-key runtime data access with user-bound RLS
   or narrowly granted, independently authorizing RPCs. Auth-administration needs,
   if any, require a separately reviewed non-data authority design; and
6. add the immutable combined migration manifest and independent negative token
   oracle to the Ministry packaging path.

This task must be implemented and reviewed in the owning repositories. Supa does
not authorize those edits.

## 19. Pilot acceptance gates

All gates are required before the first production migration:

- clean full shared migration replay from immutable committed sources;
- exact target lock to `cirqqhuvzekbvysiyedg`;
- source/package checksum and migration-ledger verification;
- Ministry, Consulting, and Workspace regression suites;
- cross-schema negative isolation for single-role and dual-role users;
- before/after token-hook noninterference for ordinary Ministry, Consulting, and
  Workspace sessions, including refresh;
- exact Workspace OAuth client/resource/audience binding and current-client
  liveness;
- unknown, malformed, revoked, wrong-resource, and wrong-audience denial;
- exact Ministry and Consulting MCP token-class denial matrix;
- Workspace MCP controlled-RPC allowlist and base/private-table denial;
- SOTF entitlement, capability, cross-tenant, revoked, and release-gate denial;
- no runtime service/secret key in Workspace or Consulting data access;
- inventory and review of all relevant `SECURITY DEFINER` functions, owners,
  search paths, execute grants, exposed schemas, and extensions;
- backup creation/verification and a timed recovery rehearsal;
- application rollback and forward-only database recovery procedure;
- production release gates default OFF;
- synthetic production acceptance plan that does not use real private data;
- audit, anomaly, error-rate, latency, resource, and Auth-hook observability;
- exact written hosted-migration authorization in
  `docs/status/extraction-status.md`; and
- separate SOTF local/product acceptance.

Only after the blockers close and these gates pass may Supa report:
`TOPOLOGY READY — PRODUCT ACCEPTANCE STILL PENDING`.

## 20. Documentation inconsistencies to correct later

Do not edit these as part of this audit. If shared production is approved, update:

| Document | Category | Required correction |
|---|---|---|
| `ADR-0011-production-supabase-allocation.md` | architecture decision clarification | Record whether the proposal is declined/deferred for the pilot and retain dedicated Personal as future hardening. |
| `docs/runbooks/production-project-separation.md` | runbook correction | Stop presenting a dedicated Personal project as the current mandatory destination; retain it as a future separation runbook. |
| `docs/status/extraction-status.md` | deployment topology update | Add one authoritative current topology section and separate historical sandbox evidence from the pilot target. |
| `docs/architecture/future-supabase-separation.md` | future hardening note | Preserve explicit scale/compliance/recovery triggers and the migration path. |
| `docs/architecture/lewis-consumer-mcp-readiness.md` | deployment topology update | Separate Entry identity authority from the Ministry shared data plane and incorporate exact product token binding. |
| `docs/architecture/personal-productization.md` | architecture decision clarification | Add project-wide Auth/MCP coexistence requirements and current-client/resource checks. |
| Consulting `ADR-0002-consulting-tenancy-schema-and-migrations.md` | obsolete proposal | Remove or qualify the statement that Personal must remain in a separate project. |
| Consulting `TARGET-TOPOLOGY-MIGRATION-PLAN.md` | obsolete proposal | Mark the dedicated-Personal topology historical/deferred and point to current decision authority. |
| Ministry Workspace package/runbook documentation | runbook correction | Replace fragmented/historical packages with the canonical shared target manifest, checksums, rollback, and product regressions. |

## 21. Is another production project required?

No additional Supabase project is required for initial pilot security or
correctness **if and only if** the bounded blockers and acceptance gates above are
closed. Logical schema/RLS/capability isolation is already designed for shared
coexistence and passed the available combined proof. Dedicated Personal
production remains recommended future hardening for independently justified
availability, compliance, scale, or operational objectives.

## 22. Recommended pilot topology

Use separate Entry production for identity/eligibility, the existing Ministry
production Supabase project for Ministry + Consulting + Workspace + SOTF data,
and independent application repositories/deployments. Keep every product's
authorization local and fail-closed. Keep Ministry as the only hosted migration
authority. Keep Workspace/SOTF release gates off until both Supa topology gates
and the separate SOTF product gates pass.

Do not resume or promote the Personal sandbox, create infrastructure, buy
capacity, or move data merely to satisfy the superseded mandatory reading of the
proposal.

## 23. Exact next implementation task

Create a separately authorized, cross-repository task named:

> Shared-project OAuth session-class hardening and canonical replay manifest

Its bounded deliverables are:

- an independent, table-driven token oracle for all ten coexistence rows;
- exact token-time resource/audience/client-liveness binding in the shared hook;
- exact product MCP verifiers and cross-schema token-class rejection;
- removal of Consulting general runtime secret-key data access;
- one target-locked Ministry combined manifest/package with immutable checksums;
  and
- clean shared replay plus Ministry, Consulting, Workspace, and negative-isolation
  regression evidence.

Do not include SOTF semantic, Unicode, ordering, NULL/type, or reference-parsing
repairs in that task.

## 24. Independent SOTF acceptance gate

Supa proves only whether the production topology can be made safe. The active
SOTF repair/acceptance workstream independently proves product correctness.
Neither substitutes for the other:

```text
Supa topology proof + bounded hardening acceptance
AND
SOTF independent local/product acceptance
→ only then may a separately authorized production release be considered
```

Current SOTF work is not production-ready by inference from this report. Its
active repairs were not modified, tested as accepted final behavior, packaged,
or deployed here.

SUPA SHARED PRODUCTION PILOT REQUIRES BOUNDED HARDENING — NO INFRASTRUCTURE PURCHASE YET
