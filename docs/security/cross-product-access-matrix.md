# Cross-product access matrix

| Principal | Workspace data | Ministry data |
| --- | --- | --- |
| Workspace owner | Allowed by Workspace membership/RLS | Must be denied unless separately ministry-authorized. |
| Workspace-only user | Their Workspace only | Expected denied/zero rows. |
| Ministry-only user | Expected denied/zero rows | Ministry policies decide. |
| Anonymous user | Denied | Must be denied. |

The Workspace side is represented locally. The ministry side cannot be marked proven until the shared project policy/function/storage audit is run.

This matrix covers product-data isolation. It does not establish third-party
service connection health or replace the separate Entry sign-in, Workspace
OAuth authorization, or subscription entitlement checks. For those boundaries
and the client's ChatGPT-managed services, see the [canonical connection
model](https://github.com/abostwick12/lead-emergence-control-plane/blob/main/docs/CONNECTION_AUTHORIZATION_ENTITLEMENT_MODEL.md).
