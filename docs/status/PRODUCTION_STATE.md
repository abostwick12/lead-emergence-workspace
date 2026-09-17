# Lead Emergence Production State

**Canonical cached summary of current production state. Live production wins whenever it disagrees with this file.**

This file contains observables and explicitly labeled unknowns only. Diagnosis, opinions, risk analysis, and proposed work belong in session output, `docs/BACKLOG.md`, or `docs/DECISIONS.md`.

## Evidence hygiene

Do not record tokens, authorization codes, PKCE material, cookies, passwords, API keys, customer payloads, or unnecessary PII here. Use sanitized IDs, timestamps, row counts, SHAs, and non-secret configuration only.

---

## 1. Database / Auth state

- **Verified at:** 2026-09-17
- **Source:** direct SQL against Supabase project `cirqqhuvzekbvysiyedg`, plus Supabase Auth/edge logs

### Recent migrations applied

| Version | Name | Observable note |
|---|---|---|
| 20260917004047 | oauth_completion_authority | Applied 2026-09-17 00:40 UTC |
| 20260916014819 | oauth_preconsent_routing_only | NULL-user pre-consent routing allowance is live |
| 20260915100000 | oauth_consent_continuation_authority | Consent classifier/continuation authority |
| 20260914010000 | sotf_v1_temporal_authority_consolidation | Last SOTF migration before OAuth work |

### Live resolver body — relevant predicate

`workspace.resolve_oauth_consent_product(text)` currently permits:

```sql
user_id = auth.uid()
OR (user_id IS NULL AND status = 'pending')
```

The function returns `deny` when the caller has no authenticated `auth.uid()`.

The function also contains an exception handler that returns `deny` for caught exceptions. This statement is recorded here only as source behavior; diagnostic implications belong elsewhere.

### Completion function

`workspace.complete_mcp_oauth_authorization(text)` exists.

Observed properties:

- SECURITY DEFINER;
- owner: `workspace_oauth_completion_owner`;
- EXECUTE granted to `authenticated`;
- calls the current resolver, Workspace grant activation, and product binding activation in sequence;
- raises when required completion work fails.

### Current row counts

| Object | Current count | Verified at |
|---|---:|---|
| `workspace_private.mcp_oauth_resource_grants` | 0 | 2026-09-17 audit |
| `private.oauth_product_client_bindings` | 0 | 2026-09-17 audit |
| `private.oauth_product_binding_audit` | 0 | 2026-09-17 audit |
| `workspace_private.mcp_oauth_admission_audit` | 1 | 2026-09-17 audit |
| `private.oauth_product_contracts` | 4 | 2026-09-17 audit |

### Feature/control state

- `workspace_private.mcp_dynamic_admission_enabled()` = `true`
  - changed at 2026-09-17 01:53:29 UTC
- `private.oauth_product_binding_control.enabled` = `true`

---

## 2. Lewis / ChatGPT OAuth state

- **Verified at:** 2026-09-17
- **Source:** production Auth tables/logs from independent read-only audit

### Current canonical replacement OAuth client

- OAuth client UUID: `8908229b-df10-4842-86b2-0b2f9f76ab3a`
- Resource: `https://workspace.leademergence.com/api/mcp`
- Created: 2026-09-15 17:52 UTC
- Redirect: ChatGPT connector callback registered for this client

### Authorization history observed

- 12 authorization rows existed at audit time.
- Rows through 2026-09-16 12:32 were pending with `user_id IS NULL`.
- One row at 2026-09-16 16:43 had an assigned user and expired.
- Two rows at 2026-09-16 17:05 and 17:15 were approved and had authorization codes issued.
- OAuth sessions for this client: `0` at audit time.
- Latest observed attempt: 2026-09-16 17:15 UTC.
- No observed attempt occurred after admission was enabled at 2026-09-17 01:53 UTC as of this audit snapshot.

### Other OAuth clients — do not mutate during Lewis diagnosis without explicit reason

- ChatGPT legacy client `f8c7a89d-bd3d-4395-97f0-0f9ac690f7a7`: live session observed during audit.
- Codex client `6a523311-60bb-475c-92e7-2e063820d732`: live session observed refreshing successfully during audit.

---

## 3. Application deployment state

### Ministry / www

- **Verified at:** not verified by the 2026-09-17 production-state audit
- **Source needed:** Vercel production deployment/dashboard plus repository source at deployed SHA

### Workspace

- **Verified at:** not verified by the 2026-09-17 production-state audit
- **Source needed:** Vercel production deployment/dashboard plus repository source at deployed SHA

Do not infer current route behavior from a local branch. Resolve deployed SHA first, then inspect repository source at that SHA.

---

## 4. Auth hook state

- **Verified at:** not yet verified
- **Current fact:** two hook functions exist with overlapping purposes.
- **Unknown:** which access-token hook is registered in GoTrue.
- **How to settle:** Supabase Dashboard → Auth → Hooks, or another authoritative current configuration source.

Do not infer the active hook from function existence.

---

## 5. Deployed consent-route state

- **Verified at:** not yet verified in this file
- **Unknown:** whether the currently deployed Workspace consent route invokes `workspace.complete_mcp_oauth_authorization(authorization_id)` after OAuth approval and before returning to ChatGPT.
- **How to settle:** identify current Workspace production deployment SHA, then inspect route source at that exact SHA; correlate with one bounded production attempt if necessary.

---

## 6. Refresh procedure

Run the relevant checks before live-state diagnosis. Add/adjust targeted queries as the architecture evolves, but keep this section read-only.

```sql
-- 6.1 Applied migrations
select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 15;

-- 6.2 Current consent resolver definition
select pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'workspace'
  and p.proname = 'resolve_oauth_consent_product';

-- 6.3 Current completion function definition
select pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'workspace'
  and p.proname = 'complete_mcp_oauth_authorization';

-- 6.4 Completion observables
select
  (select count(*) from workspace_private.mcp_oauth_resource_grants) as grants,
  (select count(*) from private.oauth_product_client_bindings) as bindings,
  (select count(*) from private.oauth_product_binding_audit) as binding_events;

-- 6.5 Current admission/binding controls
select
  workspace_private.mcp_dynamic_admission_enabled() as admission_enabled,
  (select enabled from private.oauth_product_binding_control where singleton) as binding_enabled;

-- 6.6 Recent OAuth attempts and resulting sessions
select
  a.created_at,
  a.status::text,
  (a.user_id is null) as unassigned,
  a.resource,
  c.client_name,
  c.id as oauth_client_id,
  (select count(*) from auth.sessions s where s.oauth_client_id = c.id) as sessions
from auth.oauth_authorizations a
join auth.oauth_clients c on c.id = a.client_id
order by a.created_at desc
limit 10;

-- 6.7 Admission/grant audit trail
select event_type, reason_code, created_at
from workspace_private.mcp_oauth_admission_audit
order by created_at desc
limit 10;
```

Also verify when relevant:

- active GoTrue Auth hook registration;
- current Ministry production deployment SHA;
- current Workspace production deployment SHA;
- current ChatGPT canonical Lewis connection state;
- whether a fresh attempt has occurred since the last relevant hosted change.

---

## 7. Change log

Newest first.

| Date | Production observation/change | Source |
|---|---|---|
| 2026-09-17 | Baseline production snapshot established. No production mutation performed by the audit. | direct SQL/Auth/edge-log audit against `cirqqhuvzekbvysiyedg` |
