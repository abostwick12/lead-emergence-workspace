# ADR-0003: Workspace tenancy model

Each user may create exactly one personal Workspace and active owner membership.
All data holds `workspace_id`. Organization is reserved as a type only; it is
not automatically created or shared.
