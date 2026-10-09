"""Disposable-only proof. Substitute fixture baseline pins; never use on a hosted project."""
import hashlib
import json
import pathlib
import shutil
import subprocess
import tempfile

PACKAGE = pathlib.Path(__file__).parent / "package"
EXPECTED_SOURCE = "6cd9a21389f0b6a3a40416aa0ad02443ab354cca9c506be5b186957c113ad0d3"
source = PACKAGE / "source/20261009180000_entry_dev_preview_mcp_resource_review.sql"
assert hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED_SOURCE
containers = subprocess.check_output(
    ["docker", "ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"], text=True
).splitlines()
assert len(containers) == 1, "Need exactly one disposable Supabase database"
container = containers[0]


def psql(query=None, file=None):
    args = ["docker", "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"]
    if query is not None:
        args.extend(["-c", query])
    return subprocess.run(args, input=file.read_text() if file else None, text=True, capture_output=True)


def require(result, success, label):
    if (result.returncode == 0) != success:
        raise AssertionError(f"{label}: exit={result.returncode}; {result.stderr[-1500:]}")
    print(f"{label}: PASS")


# This is a disposable stack only. The setting is changed before fingerprinting
# so the same authorization path can be exercised without any hosted mutation.
require(psql("update workspace_private.product_settings set setting_value='true' where setting_key='mcp_dynamic_admission_enabled'"), True, "synthetic admission setting")
snapshot_sql = r"""
select jsonb_build_object(
 'ledger_n',(select count(*) from supabase_migrations.schema_migrations),
 'ledger_oldest',(select min(version) from supabase_migrations.schema_migrations),
 'ledger_newest',(select max(version) from supabase_migrations.schema_migrations),
 'ledger_hash',(select md5(coalesce(string_agg(to_jsonb(r)::text,E'\n' order by to_jsonb(r)::text),'')) from supabase_migrations.schema_migrations r),
 'auth_n',(select count(*) from auth.users),
 'auth_hash',(select md5(coalesce(string_agg(to_jsonb(r)::text,E'\n' order by to_jsonb(r)::text),'')) from auth.users r),
 'workspace_n',(select count(*) from workspace.workspaces),
 'workspace_hash',(select md5(coalesce(string_agg(to_jsonb(r)::text,E'\n' order by to_jsonb(r)::text),'')) from workspace.workspaces r),
 'membership_n',(select count(*) from workspace.workspace_memberships),
 'membership_hash',(select md5(coalesce(string_agg(to_jsonb(r)::text,E'\n' order by to_jsonb(r)::text),'')) from workspace.workspace_memberships r),
 'authorization_n',(select count(*) from workspace.mcp_authorizations),
 'authorization_hash',(select md5(coalesce(string_agg(to_jsonb(r)::text,E'\n' order by to_jsonb(r)::text),'')) from workspace.mcp_authorizations r),
 'grant_n',(select count(*) from workspace_private.mcp_oauth_resource_grants),
 'grant_hash',(select md5(coalesce(string_agg(to_jsonb(r)::text,E'\n' order by to_jsonb(r)::text),'')) from workspace_private.mcp_oauth_resource_grants r),
 'settings_n',(select count(*) from workspace_private.product_settings where setting_key<>'mcp_preview_resource_uri'),
 'settings_hash',(select md5(coalesce(string_agg(to_jsonb(r)::text,E'\n' order by to_jsonb(r)::text),'')) from workspace_private.product_settings r where setting_key<>'mcp_preview_resource_uri'),
 'function_hashes',(select jsonb_object_agg(n.nspname||'.'||p.proname,md5(p.prosrc)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='workspace_private' and p.proname in ('resolve_mcp_oauth_authorization','revoke_mcp_oauth_resource_grant','is_valid_mcp_request','custom_access_token_hook')) or (n.nspname='workspace' and p.proname='activate_mcp_oauth_grant'))
);
"""
snap_result = psql(snapshot_sql)
require(snap_result, True, "synthetic baseline snapshot")
snapshot = json.loads(snap_result.stdout.strip())
assert snapshot["ledger_n"] > 31 and snapshot["ledger_newest"] < "20261009180000"


def version_count():
    result = psql("select count(*) from supabase_migrations.schema_migrations where version='20261009180000'")
    require(result, True, "ledger query")
    return int(result.stdout.strip())


assert version_count() == 0
# The unmodified, target-pinned operator must reject this different synthetic
# baseline before executing source SQL. The receipt is an expected failure.
require(psql(file=PACKAGE / "operator-apply.sql"), False, "target-pinned preflight rejects synthetic fixture")
assert version_count() == 0

old = {
    "ledger_n": ("n=31", "n=" + str(snapshot["ledger_n"])),
    "ledger_next": ("n=32", "n=" + str(snapshot["ledger_n"] + 1)),
    "ledger_oldest": ("20260819000000", snapshot["ledger_oldest"]),
    "ledger_newest": ("newest='20260929125618'", "newest='" + snapshot["ledger_newest"] + "'"),
    "ledger_hash": ("07770289d3cb570f025c421ea7537f2c", snapshot["ledger_hash"]),
    "auth_n": ("auth_n=11", "auth_n=" + str(snapshot["auth_n"])),
    "auth_hash": ("5b0d89cd03f7dd4277932b65722f2da1", snapshot["auth_hash"]),
    "workspace_n": ("workspace_n=2", "workspace_n=" + str(snapshot["workspace_n"])),
    "workspace_hash": ("e826407a88c3e0f08032f497d76611be", snapshot["workspace_hash"]),
    "membership_n": ("membership_n=2", "membership_n=" + str(snapshot["membership_n"])),
    "membership_hash": ("aff36841235f7cbd81a91e7b92024baa", snapshot["membership_hash"]),
    "authorization_n": ("authorization_n=3", "authorization_n=" + str(snapshot["authorization_n"])),
    "authorization_hash": ("1b86e64fe46ac00cd75187541542e214", snapshot["authorization_hash"]),
    "grant_n": ("grant_n=3", "grant_n=" + str(snapshot["grant_n"])),
    "grant_hash": ("e4d36c1b37fefde87d7232adec9407ff", snapshot["grant_hash"]),
    "settings_n": ("settings_n=6", "settings_n=" + str(snapshot["settings_n"])),
    "settings_hash": ("d241e3b674de7a7aee2298f134c7944e", snapshot["settings_hash"]),
}
baseline_bodies = {
    "workspace_private.resolve_mcp_oauth_authorization": "4946546f94741c166712558f64e551fd",
    "workspace.activate_mcp_oauth_grant": "4da671d77c24bf8633dcead81cf137f2",
    "workspace_private.revoke_mcp_oauth_resource_grant": "581d85010c5b9f4956de7f9705f30bfe",
    "workspace_private.is_valid_mcp_request": "0f82385662283a1dec152193af59c5f9",
    "workspace_private.custom_access_token_hook": "b8cce1c8a03316f70ef9575621a94b93",
}


def adapted(text, postflight):
    for name, (before, after) in old.items():
        if (name in ("ledger_n", "ledger_newest") and postflight) or (name == "ledger_next" and not postflight):
            continue
        if before not in text:
            raise AssertionError(f"Missing pinned marker {name}")
        text = text.replace(before, after)
    if not postflight:
        for name, pinned in baseline_bodies.items():
            local = snapshot["function_hashes"][name]
            assert pinned in text
            text = text.replace(pinned, local)
    return text


with tempfile.TemporaryDirectory() as d:
    fixture = pathlib.Path(d)
    (fixture / "source").mkdir()
    for name in ("build-operator.mjs", "preflight.sql", "postflight.sql"):
        shutil.copy2(PACKAGE / name, fixture / name)
    shutil.copy2(source, fixture / "source" / source.name)
    for name, post in (("preflight.sql", False), ("postflight.sql", True)):
        path = fixture / name
        path.write_text(adapted(path.read_text(), post))
    require(subprocess.run(["node", str(fixture / "build-operator.mjs")], capture_output=True, text=True), True, "fixture-adapted wrapper generated")

    # A forced postflight failure must roll back both schema and ledger writes.
    postflight = fixture / "postflight.sql"
    saved = postflight.read_text()
    assert "new_constraint and new_unique_index" in saved
    postflight.write_text(saved.replace("new_constraint and new_unique_index", "false and new_constraint and new_unique_index"))
    require(subprocess.run(["node", str(fixture / "build-operator.mjs")], capture_output=True, text=True), True, "forced-failure wrapper generated")
    require(psql(file=fixture / "operator-apply.sql"), False, "forced postflight failure rolls back")
    assert version_count() == 0
    assert psql("select count(*) from workspace_private.product_settings where setting_key='mcp_preview_resource_uri'").stdout.strip() == "0"

    postflight.write_text(saved)
    require(subprocess.run(["node", str(fixture / "build-operator.mjs")], capture_output=True, text=True), True, "restored fixture wrapper generated")
    require(psql(file=fixture / "operator-apply.sql"), True, "fixture-adapted transaction applied")
    assert version_count() == 1
    post = psql(file=postflight)
    require(post, True, "standalone fixture postflight")
    assert '"ready": true' in post.stdout or '"ready":true' in post.stdout
    require(psql(file=fixture / "operator-apply.sql"), False, "repeat application rejected")
    assert version_count() == 1

print("Disposable wrapper proof passed. Only fixture baseline hashes/counts were substituted; source migration bytes were unchanged.")
