# Lead Emergence Agent Truth Source

This package establishes one shared operating system for coding agents across Lead Emergence.

## Canonical authority

1. Live production state
2. Refreshed `docs/status/PRODUCTION_STATE.md`
3. `docs/ROADMAP.md`
4. `docs/DECISIONS.md`
5. `docs/BACKLOG.md`
6. Repository source at the deployed SHA
7. Historical handoffs, archived status notes, prior agent summaries, chat transcripts

`AGENTS.md` is the canonical platform-independent agent mandate. Platform-specific files are thin adapters only; they must not duplicate or override policy.

## Canonical files

- `AGENTS.md`
- `docs/ROADMAP.md`
- `docs/status/PRODUCTION_STATE.md`
- `docs/DECISIONS.md`
- `docs/BACKLOG.md`
- `agent-skills/state-refresh/SKILL.md`
- `agent-skills/assumption-challenge/SKILL.md`
- `agent-skills/scope-lock/SKILL.md`

## Platform adapters included

- Claude Code: `CLAUDE.md`
- Gemini: `GEMINI.md`
- GitHub Copilot: `.github/copilot-instructions.md`
- Cursor: `.cursor/rules/lead-emergence.mdc`
- Windsurf: `.windsurf/rules/lead-emergence.md`
- Roo: `.roo/rules/lead-emergence.md`

For any new coding platform, create only a thin adapter that says to read root `AGENTS.md` first and follow the canonical files above. Do not fork policy text.

## Installation rule

Do not overwrite a newer or materially different canonical file blindly. Inventory existing instruction files first. Preserve dirty worktrees. Install documentation/governance changes in dedicated commits, with no product code, migrations, deployments, or production mutations.

Historical status/handoff files should be marked historical and pointed at `docs/status/PRODUCTION_STATE.md`; archive them only after checking repository references.

## Evidence hygiene

Never commit tokens, passwords, cookies, OAuth authorization codes, PKCE material, service keys, customer payloads, or unnecessary PII as evidence.
