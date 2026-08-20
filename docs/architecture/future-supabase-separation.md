# Future Supabase separation

The Workspace migration chain builds only `workspace` and `workspace_private`. All records carry `workspace_id`; no Workspace table has a foreign key to a ministry business table. Files are in one private bucket with Workspace-prefixed keys. A future split copies Auth user IDs, Workspace schemas/data, bucket objects, and integration secret references, then changes Workspace environment values.

Trigger the split when paid/external usage, organization workspaces, security review, quotas, or recovery/compliance requirements make the shared-project blast radius unacceptable. The extraction does not perform that split.
