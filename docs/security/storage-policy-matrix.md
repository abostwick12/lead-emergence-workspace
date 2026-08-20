# Storage policy matrix

Bucket: `workspace-private`, private.

| Operation | Policy |
| --- | --- |
| List/download/signed URL | Active membership for UUID at first object-path segment. |
| Upload | Current user owns the object and is personal Workspace owner for that path. |
| Replace/move/copy | Same owner and Workspace checks before and after change. |
| Delete | Current user owns the object and is Workspace owner. |

Paths are `{workspace_id}/{entity_type}/{entity_id}/{file_name}`. Use Storage
APIs only; never direct SQL against `storage.objects`.
