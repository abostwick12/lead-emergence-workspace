---
name: assumption-challenge
description: "Require falsifiable reasoning before a Lead Emergence production fix, migration, auth/security change, schema change, or root-cause claim. Use before accepting a prior agent's conclusion or Andrew's proposed technical fix when the answer affects production."
---

# Assumption Challenge

## Purpose

A diagnosis that cannot be disproved is a story, not a localized defect.

## Full protocol — required for auth/security/schema/migrations/root-cause decisions

```text
CLAIM:
FALSIFIER:
FALSIFIER RESULT:
EVIDENCE:
  VERIFIED:
  INFERRED:
  ASSUMED:
EXISTING PATH CONSIDERED:
  Closest supported object/path:
  Specific failing predicate:
BEST ALTERNATIVE EXPLANATION:
DISTINGUISHING OBSERVATION:
PRIOR ATTEMPTS AT THIS SYMPTOM:
SMALLEST COHERENT CHANGE:
PRODUCTION OBSERVABLE THAT PROVES DONE:
```

Any `ASSUMED` item required for the recommendation must be verified before recommending a production mutation.

## Routine bug compact form

For low-risk/local deterministic work, use:

```text
CLAIM:
CHEAPEST FALSIFIER + RESULT:
EXISTING PATH:
SMALLEST CHANGE:
DONE OBSERVABLE:
```

## Existing-path rule

Before creating a route, RPC, table, function, role, schema, or abstraction:

1. search by behavior and name for the closest existing path;
2. name the exact predicate that prevents it from closing the observable;
3. explain what breaks if it is used unchanged.

“Cleaner” and “more correct architecturally” are not failing predicates.

## Argue the alternative

Name the strongest alternative explanation that fits the same evidence and the observation that distinguishes it. If both explanations predict the same observation, localize further before changing production.

## Two-strike rule

After two attempts of the same class for one symptom, stop. Produce a conflict report and new instrumentation/observation. No third layered attempt.
