$ErrorActionPreference = 'Stop'

$container = 'supabase_db_lead-emergence-workspace-local'
$userId = [guid]::NewGuid().ToString()
$identityId = [guid]::NewGuid().ToString()
$subjectId = [guid]::NewGuid().ToString()
$provider = 'custom:lead-emergence-entry-workspace-prod'

function Invoke-LocalSql([string]$Sql) {
  $Sql | docker exec -i $container psql -v ON_ERROR_STOP=1 -U postgres -d postgres | Out-String
  if ($LASTEXITCODE -ne 0) { throw 'Local Postgres command failed.' }
}

docker inspect $container | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Expected local Supabase database container '$container' is not running. Run supabase start first." }

Invoke-LocalSql @"
insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000000','$userId','authenticated','authenticated','concurrency.$userId@example.invalid','',now(),'{"provider":"$provider","providers":["$provider"]}','{}',now(),now());
insert into auth.identities (id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
values ('$identityId','$userId','$subjectId','{"sub":"$subjectId","name":"Concurrency Workspace User"}','$provider',now(),now(),now());
update workspace_private.trusted_identity_providers set enabled = true where provider_identifier = '$provider';
"@

$provisionSql = "begin; set local role authenticated; select set_config('request.jwt.claims', '{`"sub`":`"$userId`",`"role`":`"authenticated`"}', true); select pg_sleep(1); select workspace.ensure_personal_workspace(); commit;"
$first = Start-Job -ScriptBlock { param($container, $sql) docker exec $container psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c $sql } -ArgumentList $container, $provisionSql
$second = Start-Job -ScriptBlock { param($container, $sql) docker exec $container psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c $sql } -ArgumentList $container, $provisionSql
Wait-Job $first, $second | Out-Null
$firstOutput = Receive-Job $first 2>&1
$secondOutput = Receive-Job $second 2>&1
Remove-Job $first, $second
if ($first.State -ne 'Completed' -or $second.State -ne 'Completed') { throw "Concurrent provisioning failed. Session A: $firstOutput Session B: $secondOutput" }

$counts = Invoke-LocalSql @"
select json_build_object(
  'workspaces', (select count(*) from workspace.workspaces where owner_user_id='$userId' and workspace_type='personal'),
  'memberships', (select count(*) from workspace.workspace_memberships where user_id='$userId' and role='owner' and status='active'),
  'plans', (select count(*) from workspace.personal_plans where user_id='$userId'),
  'onboarding', (select count(*) from workspace.personal_onboarding where user_id='$userId')
);
"@

if ($counts -notmatch '"workspaces"\s*:\s*1' -or $counts -notmatch '"memberships"\s*:\s*1' -or $counts -notmatch '"plans"\s*:\s*1' -or $counts -notmatch '"onboarding"\s*:\s*1') {
  throw "Concurrent provisioning violated Personal tenancy invariants: $counts"
}

Write-Output 'PASS: simultaneous first-login provisioning produced exactly one Workspace, owner membership, plan, and onboarding row.'