# ADR-0010: Future Supabase project separation

Workspace remains portable because schemas, data, bucket paths, migrations,
environment settings, and integration references are independently owned. A
future split is a migration/configuration project, not an application rewrite.
