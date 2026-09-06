# R5E.8K human-local PKCE acceptance harness

This package is an isolated, static, human-only acceptance artifact for Fixture C of R5E.8C. It contains no Next.js, React, Supabase Auth SDK, application middleware, server handler, analytics, telemetry, service worker, remote asset, or source map. It is not part of the Workspace runtime and is not authorized for deployment by R5E.8L.

The immutable ceremony order is:

`PKCE recovery → recovery evidence → pending email change → pending-email evidence → password update → final evidence`

The checked-in `run-manifest.example.json` is deliberately marked `syntheticOnly: true`. The generated checked-in-style `dist/` is therefore inert: runtime validation stops before any request. A later, separately authorized deployment preflight must supply a reviewed active manifest whose project, callback, public key fingerprint, ES256 verification key, Fixture C binding, time window, Auth settings, and budgets all match the immutable schema.

## Request and secret contract

The script can construct only these programmatic Auth requests. Every request uses `credentials: "omit"`, `redirect: "error"`, `cache: "no-store"`, `keepalive: false`, a no-referrer policy, and a single `fetch` attempt.

| Phase | Exact request |
| --- | --- |
| Recovery | `POST https://vnjdubrnmxvmsccxmhst.supabase.co/auth/v1/recover?redirect_to=<exact callback>` with the manifest current email, one S256 challenge, and public/anon headers |
| Exchange | `POST https://vnjdubrnmxvmsccxmhst.supabase.co/auth/v1/token?grant_type=pkce` with one callback code and the closure-held verifier |
| Email change | `PUT https://vnjdubrnmxvmsccxmhst.supabase.co/auth/v1/user?redirect_to=<exact callback>` with the manifest successor email and the original recovery access token |
| Password | `PUT https://vnjdubrnmxvmsccxmhst.supabase.co/auth/v1/user` with the private password and the same original recovery access token |

Browser-generated CORS preflights and the human's mailbox/verification navigation are distinct from those programmatic requests. There is no refresh, logout, resend, reauthentication, signup, OTP verification, final `/user` probe, application request, database/RPC call, retry, or compensating mutation.

The only allowed secret locations are the protocol-required ones:

- Before exchange, the PKCE verifier exists in the exact `sessionStorage` continuation record. On callback it is moved into a private closure, storage is replaced and read-back verified as a nonsecret terminal marker, and only then is the exchange transmitted. Continuation authority is never restored.
- The authorization code exists in the callback query until the first synchronous script step replaces the history entry, then in the private closure and direct exchange body.
- The verifier exists in the direct exchange body. The exchange response necessarily carries an access token and refresh token; the access token is retained only in the private closure, while the refresh-token property and response payload references are overwritten immediately after structural validation.
- The password exists only in the private password control, a short-lived local variable, and the direct password request body. The control is cleared before transmission.
- The original access token exists only in the private closure and the two approved mutation `Authorization` headers. No token-replacement path exists.

No secure-memory-erasure claim is made. The browser profile must be disposable, extension-free, sync-free, automation-free, and used as one manually controlled top-level tab without opener, duplication, crash restore, DevTools, or remote debugging.

## Fail-closed lifecycle

Every request is latched before transmission. Timeout, transport loss, malformed response, callback error, expiry, storage verification failure, duplicate context, or uncertain result disables all controls and permits only sanitized database evidence. The harness never retries, resends, refreshes, logs out, reverses a mutation, or probes `/user` afterward.

The continuation record is `r5e8c-pkce-continuation/v1`, is bound to the run/manifest/fixture/nonce, and expires exactly 240 seconds after creation. Before exchange it is atomically replaced and read-back verified as `r5e8c-pkce-terminal/v1`; the marker contains no verifier, code, token, password, email URL, or session identifier and expires at the artifact hard stop. Reload, Back, BFCache restore, duplicate callback, and a second top-level context stay terminal.

## Local build and tests

Use Node 24. Dependencies are exact-pinned in `package.json` and `package-lock.json`.

```text
npm ci --ignore-scripts
npm run typecheck
npm run test
npm run build
npm run verify
npm run test:browser
npm run test:gotrue
```

`npm run build` also generates an ignored, active synthetic artifact used only by the browser tests. Its fixed test signing key is synthetic and the private component is never bundled into its `dist/`. The production-shaped `dist/auth/callback/index.html` and inert `dist/404.html` are generated from the inert example manifest.

`npm run test:gotrue` requires a local Docker daemon. It pulls and verifies the exact linux/amd64 GoTrue image pin in `gotrue-image.json`, creates only random-named local containers/network and synthetic local users, and removes those exact containers/network in `finally`. The test asserts signed recovery AMR, wrong-verifier and stale-flow rejection, pending-email/token state, password fencing, same-session survival, exact original-token reuse, and the normative simultaneous exchange result: one success, one rejection, one new recovery session, and consumed flow state. Two successful exchanges is an explicit hard failure.

## Later deployment preflight and teardown

R5E.8L does not authorize deployment. Before any later hosted use, R5E.8M must independently prove the callback hostname's query-log retention and recipients with a noncredential canary; absence of log drains/security interception; exclusive whole-hostname static routing; inert other paths; no toolbar/runtime injection, service worker, Entry/Workspace/Next code, alias automation, or stale cache; exact delivered-byte/header hashes; current hosted project/Auth settings; and a reviewed active manifest.

After a separately authorized hosted run, the human must close the tab and destroy the disposable browser profile before the exclusive alias window ends. Deployment removal, alias restoration, old-URL inertness checks, and exact-fixture cleanup all remain separately authorized actions. This package has no teardown request or hosted cleanup capability.
