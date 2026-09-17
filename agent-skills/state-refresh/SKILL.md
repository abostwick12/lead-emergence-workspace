---
name: state-refresh
description: "Re-establish actual live production state before Lead Emergence diagnosis or any recommendation that depends on what is currently deployed. Use for debugging, auth/security, migrations, deployments, billing, tenant isolation, entitlements, and current-state questions. Do not invoke production merely for formatting, documentation-only work, or isolated local source inspection that does not depend on live state."
---

# State Refresh

## Purpose

Never diagnose today's system from yesterday's document.

`docs/status/PRODUCTION_STATE.md` is a cached truth source, not a substitute for live state. If live state contradicts it, live state wins and the file is corrected in the same session.

## Protocol

### 1. Refresh only the live surfaces relevant to the task

Use the Refresh Procedure in `docs/status/PRODUCTION_STATE.md` plus the smallest additional authoritative checks needed.

Typical surfaces:

- database/migration ledger and live database function definitions;
- current feature/control values;
- current production deployment SHA and source at that SHA;
- current Auth hook registration;
- current ChatGPT/Lewis connection state;
- the latest real attempt and whether anything has been retried since the latest relevant change.

For application routes, verify **production deployment SHA → repository source at that SHA**. Do not pretend a local branch proves deployed route behavior.

### 2. Compare cached state with reality

Mark decision-critical claims:

- `CONFIRMED` — reproduced now;
- `STALE` — live state disagrees;
- `UNVERIFIABLE` — current access cannot establish it.

Correct stale cached state immediately.

### 3. Ask the task-ending question

**Has the affected path actually been retried since the last relevant production change?**

If no, retry the supported path before inventing another diagnosis unless retry itself is unsafe.

### 4. Only then form a hypothesis

State one claim and the cheapest observation that would falsify it.

## Required diagnostic header

```text
STATE REFRESH
  Checked at:
  Relevant live surfaces checked:
  Deployed version(s):
  Last real attempt:
  Retried since last relevant change:
  Stale claims found:
  Could not verify:
```

Use this header only when live state materially matters.

## Stop conditions

Stop rather than proceeding when:

- live state contradicts the assigned task;
- the proposed change is already live;
- the flow has not been retried since the last relevant change;
- the task depends on a live surface you cannot verify.
