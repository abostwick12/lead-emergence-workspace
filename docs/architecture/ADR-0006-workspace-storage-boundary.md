# ADR-0006: Workspace Storage boundary

Workspace files use one private bucket, Workspace-prefixed paths, and
`storage.objects` RLS. Direct SQL mutations of Storage objects are prohibited.
