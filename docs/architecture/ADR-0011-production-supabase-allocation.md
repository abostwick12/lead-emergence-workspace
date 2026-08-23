# ADR-0011: Proposed production Supabase allocation

Status: **PROPOSED — awaiting explicit infrastructure and data-disposition approval**

## Context

Lead Emergence production currently uses `emergence-ministry-platform`
(`cirqqhuvzekbvysiyedg`) for Ministry and existing shared production workloads.
Goal B adds an Entry OAuth authority, Workspace Auth provider, MCP OAuth server,
Personal authorization, and private Workspace data. Putting those new concerns
back into the Ministry project would preserve the largest blast radius and keep
Workspace migrations dependent on the Ministry release authority.

Two other projects already exist in the `EMERGEnce` organization:

- `lead-emergence-personal-sandbox` (`nhkugzifuapplwpnfpbt`) is active, contains
  the accepted Personal/Workspace migration chain, and is clean of Auth users,
  Workspace tenant data, OAuth clients, and OAuth consents after acceptance
  cleanup.
- `lead-emergence-meridian-sandbox` (`lpqgjnuvfvuuashcmlxq`) is paused with its
  data preserved. It has not been inventoried or approved for destructive reuse.

The Ministry production project is not an empty source. Current read-only
inventory shows one Workspace, one membership, seven `reconnect_required`
integration metadata rows, eighteen AI-conversation rows, one Daily Brief, and
fifty-two audit rows. All other Workspace/private user-data tables are empty.
The integration rows contain neither a secret reference nor an account label.
Those records are treated as real until the owner explicitly classifies them;
no record is moved or deleted by this decision.

The organization still reports the Free plan. The Management API currently
quotes a new project at `$0` monthly, but the earlier creation attempt failed
for project capacity. A zero cost quote does not prove that three projects may
run simultaneously; the partner benefit or additional capacity must be
confirmed before creation.

## Proposed decision

1. Keep `emergence-ministry-platform` unchanged as the Ministry/legacy
   production authority. Do not apply Goal B Entry or Workspace productization
   migrations there.
2. Promote the already-proven `lead-emergence-personal-sandbox` project to the
   Workspace/Personal production candidate. Promotion means a reviewed rename,
   production Auth/OAuth configuration, key rotation, environment reassignment,
   and canary; it does not mean copying Preview credentials or skipping cutover
   approval.
3. Prefer a new partner-backed project for Entry production if the partner
   organization provides approved capacity. If no clean project is available,
   `lead-emergence-meridian-sandbox` is the fallback Entry production candidate,
   but only after its retained data is inventoried/exported and explicit
   repurpose approval is recorded.
4. Keep Entry and Workspace in separate Supabase projects. Entry identity and
   global Personal eligibility must remain distinct from Workspace membership,
   plan capability, MCP permission, and record authorization.

## Why Meridian is not the Workspace candidate

Repurposing Meridian for Workspace would discard the strongest available
evidence: the Personal project already passed the full hosted migration,
authorization, onboarding, mobile, and one-login acceptance matrix. It would
require rebuilding and revalidating the same state while leaving the separate
Entry production-backend requirement unsolved.

## Approval boundary

This ADR records a recommended allocation only. It does not authorize restoring
or wiping Meridian, changing an organization plan, creating a paid project,
renaming the Personal project, rotating production credentials, changing Vercel
Production variables, merging either product PR, or routing live traffic.
The source owner and records remain in Ministry until the reviewed procedure in
`docs/runbooks/production-project-separation.md` is explicitly authorized.
