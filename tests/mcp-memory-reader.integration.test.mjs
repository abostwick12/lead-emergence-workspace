import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import postgres from "postgres";

const databaseUrl = process.env.MCP_MEMORY_TEST_DATABASE_URL;

test("restored Memory reader preserves private access and bounded reads", {
  skip: !databaseUrl && "Set MCP_MEMORY_TEST_DATABASE_URL to an existing local test database.",
  timeout: 30_000
}, async (t) => {
  const target = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname), "Only loopback test databases are allowed.");
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 3 });
  const connection = await sql.reserve();
  const owner = "e7111111-1111-4111-8111-111111111111";
  const other = "e7222222-2222-4222-8222-222222222222";
  const workspace = "e7aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const otherWorkspace = "e7bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const client = "e7cccccc-cccc-4ccc-8ccc-cccccccccccc";
  const canonicalResource = "https://workspace.leademergence.com/api/mcp";
  const resource = (await connection`select setting_value from workspace_private.product_settings where setting_key='mcp_resource_uri'`)[0].setting_value;
  const migration = await readFile(new URL("../supabase/migrations/20261004153000_mcp_memory_read_parity.sql", import.meta.url), "utf8");
  const claims = { sub: owner, role: "authenticated", aud: resource, resource, client_id: client, workspace_mcp: true, iat: Math.floor(Date.now() / 1000) };
  let originalDefinition;

  async function expectDenied(statement, code) {
    await connection.unsafe("SAVEPOINT expected_error");
    try {
      await assert.rejects(() => connection.unsafe(statement), (error) => error.code === code);
    } finally {
      await connection.unsafe("ROLLBACK TO SAVEPOINT expected_error");
      await connection.unsafe("RELEASE SAVEPOINT expected_error");
    }
  }

  try {
    originalDefinition = await connection`select pg_get_functiondef(to_regprocedure('workspace.mcp_list_memory(text,integer)')) as definition`;
    await connection.unsafe("BEGIN; SET LOCAL statement_timeout = '10s'; SET LOCAL lock_timeout = '2s'");
    await connection.unsafe("DROP FUNCTION IF EXISTS workspace.mcp_list_memory(text,integer)");
    assert.equal((await connection`select to_regprocedure('workspace.mcp_list_memory(text,integer)')::text as rpc`)[0].rpc, null);
    await connection.unsafe(migration);

    await connection.unsafe(`
      insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
      ('00000000-0000-0000-0000-000000000000','${owner}','authenticated','authenticated','memory.owner@example.invalid','',now(),'{}','{}',now(),now()),
      ('00000000-0000-0000-0000-000000000000','${other}','authenticated','authenticated','memory.other@example.invalid','',now(),'{}','{}',now(),now());
      insert into workspace.user_profiles(user_id,display_name) values ('${owner}','Memory owner fixture'),('${other}','Other owner fixture');
      insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values ('${workspace}','personal','Memory fixture','${owner}'),('${otherWorkspace}','personal','Other fixture','${other}');
      insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values ('${workspace}','${owner}','owner','active'),('${otherWorkspace}','${other}','owner','active');
      insert into workspace.personal_plans(workspace_id,user_id,plan_key) values ('${workspace}','${owner}','personal'),('${otherWorkspace}','${other}','personal');
      insert into workspace.mcp_authorizations(workspace_id,client_id,assistant_provider,status,connected_at,created_by) values ('${workspace}','${client}','chatgpt','connected',now(),'${owner}');
      update workspace_private.product_settings set setting_value='true' where setting_key='mcp_dynamic_admission_enabled';
      insert into workspace_private.mcp_oauth_resource_grants(user_id,client_id,resource_uri,granted_scopes) values ('${owner}','${client}','${canonicalResource}',array['openid','email','profile']);
      insert into workspace.memory_entries(id,workspace_id,memory_type,content,domain,created_by,created_at) values
      ('e7000000-0000-4000-8000-000000000001','${workspace}','context','Older owner memory','life','${owner}','2026-01-01'),
      ('e7000000-0000-4000-8000-000000000002','${workspace}','context','Newer owner memory','leadership','${owner}','2026-01-02'),
      ('e7000000-0000-4000-8000-000000000003','${otherWorkspace}','context','Other workspace memory','life','${other}','2026-01-03'),
      ('e7000000-0000-4000-8000-000000000004','${workspace}','context','Different creator memory','life','${other}','2026-01-04');
    `);
    const before = (await connection`select jsonb_agg(to_jsonb(m) order by id) as snapshot from workspace.memory_entries m where id::text like 'e7000000-%'`)[0].snapshot;
    const privileges = (await connection`select has_function_privilege('anon','workspace.mcp_list_memory(text,integer)','EXECUTE') as anon, has_function_privilege('authenticated','workspace.mcp_list_memory(text,integer)','EXECUTE') as authenticated,
      exists(select 1 from pg_proc p, aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='workspace.mcp_list_memory(text,integer)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE') as public`)[0];
    assert.deepEqual(privileges, { anon: false, authenticated: true, public: false });

    await t.test("anonymous callers cannot execute the reader", async () => {
      await connection.unsafe("SET LOCAL ROLE anon");
      await expectDenied("select workspace.mcp_list_memory()", "42501");
      await connection.unsafe("RESET ROLE");
    });

    await connection.unsafe("SET LOCAL ROLE authenticated");
    await connection`select set_config('request.jwt.claims',${JSON.stringify(claims)},true)`;
    await t.test("missing-function recovery returns only this owner's records in stable order", async () => {
      const [{ result }] = await connection`select workspace.mcp_list_memory() as result`;
      assert.deepEqual(result.memory.map((m) => m.content), ["Newer owner memory", "Older owner memory"]);
      assert.deepEqual(Object.keys(result.memory[0]).sort(), ["id", "memory_type", "content", "domain", "created_at", "updated_at"].sort());
    });
    await t.test("page bounds and domains filter the owned result", async () => {
      const [{ result }] = await connection`select workspace.mcp_list_memory(null,1) as result`;
      assert.equal(result.memory.length, 1);
      assert.equal(result.memory[0].content, "Newer owner memory");
      const [{ filtered }] = await connection`select workspace.mcp_list_memory('life',50) as filtered`;
      assert.deepEqual(filtered.memory.map((m) => m.content), ["Older owner memory"]);
      const [{ empty }] = await connection`select workspace.mcp_list_memory('job_search',25) as empty`;
      assert.deepEqual(empty, { memory: [] });
      for (const size of [0, 51, "null"]) await expectDenied(`select workspace.mcp_list_memory(null,${size})`, "22023");
      await expectDenied("select workspace.mcp_list_memory('unsupported',25)", "22023");
    });
    await t.test("ordinary browser and wrong-audience claims cannot read memory", async () => {
      await connection`select set_config('request.jwt.claims',${JSON.stringify({ sub: owner, role: "authenticated", aud: "authenticated" })},true)`;
      await expectDenied("select workspace.mcp_list_memory()", "42501");
      await connection`select set_config('request.jwt.claims',${JSON.stringify({ ...claims, aud: "https://other.example.invalid/api/mcp" })},true)`;
      await expectDenied("select workspace.mcp_list_memory()", "42501");
      await connection`select set_config('request.jwt.claims',${JSON.stringify(claims)},true)`;
    });
    await t.test("disabled Memory capability and disconnected connection still deny reads", async () => {
      await connection.unsafe("RESET ROLE");
      await connection.unsafe("SAVEPOINT capability_change");
      await connection`update workspace.plan_capabilities set enabled=false where plan_key='personal' and capability_key='memory'`;
      await connection.unsafe("SET LOCAL ROLE authenticated");
      await expectDenied("select workspace.mcp_list_memory()", "42501");
      await connection.unsafe("ROLLBACK TO SAVEPOINT capability_change; RELEASE SAVEPOINT capability_change; RESET ROLE");
      await connection`update workspace.mcp_authorizations set status='disconnected' where workspace_id=${workspace} and client_id=${client}`;
      await connection.unsafe("SET LOCAL ROLE authenticated");
      await expectDenied("select workspace.mcp_list_memory()", "42501");
    });
    await t.test("revoked resource grant still denies the reader", async () => {
      await connection.unsafe("RESET ROLE");
      await connection`update workspace.mcp_authorizations set status='connected' where workspace_id=${workspace} and client_id=${client}`;
      await connection`update workspace_private.mcp_oauth_resource_grants set status='revoked',revoked_at=now() where user_id=${owner} and client_id=${client}`;
      await connection.unsafe("SET LOCAL ROLE authenticated");
      await expectDenied("select workspace.mcp_list_memory()", "42501");
    });
    await connection.unsafe("RESET ROLE");
    const after = (await connection`select jsonb_agg(to_jsonb(m) order by id) as snapshot from workspace.memory_entries m where id::text like 'e7000000-%'`)[0].snapshot;
    assert.deepEqual(after, before, "Reads and denials preserve all fixture memory rows.");
  } finally {
    try {
      await connection.unsafe("ROLLBACK");
      if (originalDefinition) {
        assert.deepEqual(await connection`select pg_get_functiondef(to_regprocedure('workspace.mcp_list_memory(text,integer)')) as definition`, originalDefinition, "Rollback restores the original local function.");
        assert.equal((await connection`select count(*)::integer as count from auth.users where id in (${owner},${other})`)[0].count, 0, "No test users persist.");
      }
    } finally {
      connection.release();
      await sql.end({ timeout: 2 });
    }
  }
});
