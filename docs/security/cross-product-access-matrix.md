# Cross-product access matrix

| Principal | Workspace data | Ministry data |
| --- | --- | --- |
| Workspace owner | Allowed by Workspace membership/RLS | Must be denied unless separately ministry-authorized. |
| Workspace-only user | Their Workspace only | Expected denied/zero rows. |
| Ministry-only user | Expected denied/zero rows | Ministry policies decide. |
| Anonymous user | Denied | Must be denied. |

The Workspace side is represented locally. The ministry side cannot be marked proven until the shared project policy/function/storage audit is run.
