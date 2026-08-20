# ADR-0004: Shared Auth boundary

`auth.users` is the only intentional shared dependency. Workspace neither reads
ministry profiles/roles nor grants ministry capability during signup.
