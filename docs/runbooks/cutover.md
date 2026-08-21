# Cutover

Gate D production cutover completed on 2026-08-21. The standalone Workspace is
the only active Command Center UI. Ministry no longer advertises Command Center;
legacy UI routes use temporary 307 redirects to fixed Workspace destinations,
and every legacy API method returns an intentional no-store 410 before its old
handler can run.

The hosted write freeze is implemented by one statement-level
`gate_d_legacy_write_freeze` trigger on each of the seven production-confirmed
legacy tables. The triggers cover INSERT, UPDATE, and DELETE. They do not change
grants or RLS, so authenticated SELECT and rollback evidence remain available.
The five absent knowledge/feed candidates are not included.

During stabilization, check the route/API matrix, both production deployments,
Workspace authentication and clock preference saves, the seven freeze triggers
and retained row counts, the empty-or-separately-authorized Ministry Gmail token
state, and relevant runtime errors. Do not reconnect Workspace integrations,
enable uploads, delete legacy data, or perform cleanup. Cleanup requires a new
approval after the 14-day stabilization window.
