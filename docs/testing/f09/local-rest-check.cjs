// Disposable local F09 boundary checks. No hosted URL or configurable credentials.
const { spawn } = require('node:child_process');
const { createHmac } = require('node:crypto');
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const root = require('node:path').resolve(__dirname, '../../..');
const workspaceA = 'f09aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const workspaceB = 'f09bbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const alice = 'f0911111-1111-4111-8111-111111111111';
const bob = 'f0922222-2222-4222-8222-222222222222';
const capture = n => `f0900000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function docker(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', x => out += x); child.stderr.on('data', x => err += x);
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(out) : reject(new Error(`Docker exit ${code}: ${err}`)));
    child.stdin.end(input);
  });
}
function token(user, session) {
  const enc = x => Buffer.from(JSON.stringify(x)).toString('base64url');
  const body = `${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:user,role:'authenticated',aud:'authenticated',session_id:session,exp:Math.floor(Date.now()/1000)+3600})}`;
  return `${body}.${createHmac('sha256','f09-local-only-synthetic-jwt-secret-at-least-32').update(body).digest('base64url')}`;
}
async function api(user, path, body, session='f09-session-one') {
  const args = ['exec','-i','f09-db-20261119','curl','-sS','--max-time','20','-w','\n%{http_code}',
    '-H',`Authorization: Bearer ${token(user,session)}`,'-H','Content-Profile: workspace','-H','Accept-Profile: workspace'];
  if (body) args.push('-H','Content-Type: application/json','--data-binary','@-');
  args.push(`http://f09-rest-20261119:3000/${path}`);
  const out = await docker(args, body ? JSON.stringify(body) : undefined);
  const split = out.lastIndexOf('\n');
  return {status:Number(out.slice(split+1)),data:JSON.parse(out.slice(0,split))};
}
async function convert(user, workspace, n, domain='general', session) {
  return api(user,'rpc/resolve_capture_to_task',{target_workspace_id:workspace,target_capture_id:capture(n),task_domain:domain},session);
}
async function snapshot(user, workspace, n) {
  const tasks = await api(user,`tasks?workspace_id=eq.${workspace}&select=id,title,domain`);
  const row = await api(user,`capture_inbox?id=eq.${capture(n)}&select=id,status,routed_task_id,raw_text`);
  assert.equal(tasks.status,200); assert.equal(row.status,200);
  return {taskCount:tasks.data.length,capture:row.data[0],tasks:tasks.data};
}
(async () => {
  assert.equal(await docker(['inspect','f09-db-20261119','--format','{{index .Config.Labels "task"}}']), 'f09-20261119\n');
  const fixture = readFileSync(`${root}/supabase/tests/database/native_capture_to_task.sql`,'utf8');
  const setup = fixture.slice(0,fixture.indexOf('select ok(')).replace('select no_plan();','')+'\ncommit;\n';
  await docker(['exec','-i','f09-db-20261119','psql','-U','postgres','-d','f09_test','-v','ON_ERROR_STOP=1'], setup);
  const results = [];
  const first = await convert(alice,workspaceA,1,'life'); assert.equal(first.status,200); assert.equal(first.data.already_processed,false);
  const replay = await convert(alice,workspaceA,1,'leadership'); assert.equal(replay.status,200); assert.equal(replay.data.task.id,first.data.task.id); assert.equal(replay.data.task.domain,'life'); assert.equal(replay.data.already_processed,true);
  const normal = await snapshot(alice,workspaceA,1); assert.equal(normal.taskCount,1); assert.equal(normal.capture.routed_task_id,first.data.task.id);
  results.push({case:'normal, sequential retry, processed retry, changed input',taskCount:normal.taskCount,taskId:first.data.task.id,status:normal.capture.status});
  const concurrent = await Promise.all(Array.from({length:6},(_,i)=>convert(alice,workspaceA,2,i%2?'leadership':'life',`f09-independent-session-${i}`)));
  concurrent.forEach(x=>assert.equal(x.status,200)); assert.equal(new Set(concurrent.map(x=>x.data.task.id)).size,1); assert.equal(concurrent.filter(x=>!x.data.already_processed).length,1);
  const race = await snapshot(alice,workspaceA,2); assert.equal(race.taskCount,2); assert.equal(race.capture.routed_task_id,concurrent[0].data.task.id);
  results.push({case:'six concurrent HTTP sessions / double activation',newTasks:1,taskCount:race.taskCount,taskId:race.capture.routed_task_id,status:race.capture.status});
  // Commit succeeds but deliberately do not consume the response in the caller.
  await convert(alice,workspaceA,3);
  const ackRetry = await convert(alice,workspaceA,3); assert.equal(ackRetry.status,200); assert.equal(ackRetry.data.already_processed,true);
  const lost = await snapshot(alice,workspaceA,3); assert.equal(lost.taskCount,3); assert.equal(lost.capture.routed_task_id,ackRetry.data.task.id);
  results.push({case:'ignored committed acknowledgement then retry',newTasks:1,taskCount:lost.taskCount,taskId:lost.capture.routed_task_id,status:lost.capture.status});
  const reloadFirst = await convert(alice,workspaceA,8); assert.equal(reloadFirst.status,200);
  const reload = await convert(alice,workspaceA,8,'general','f09-fresh-session-after-reload'); assert.equal(reload.status,200); assert.equal(reload.data.task.id,reloadFirst.data.task.id);
  const refreshed = await snapshot(alice,workspaceA,8); assert.equal(refreshed.taskCount,4);
  results.push({case:'fresh HTTP session preserves capture identity',newTasks:1,taskCount:4,taskId:reload.data.task.id});
  for (const [user,workspace,n] of [[alice,workspaceB,9],[bob,workspaceA,1],[alice,workspaceA,999]]) {
    const denied = await convert(user,workspace,n); assert.equal(denied.status,403); assert.equal(denied.data.code,'42501');
  }
  for (const n of [4,5]) { const failure = await convert(alice,workspaceA,n); assert.equal(failure.status,400); assert.equal(failure.data.code,'P0001'); }
  const beforeBob = await snapshot(bob,workspaceB,9); assert.equal(beforeBob.taskCount,0); assert.equal(beforeBob.capture.status,'unprocessed');
  const legitimateBob = await convert(bob,workspaceB,9); assert.equal(legitimateBob.status,200);
  const afterBob = await snapshot(bob,workspaceB,9); assert.equal(afterBob.taskCount,1);
  const finalA = await snapshot(alice,workspaceA,1); assert.equal(finalA.taskCount,4);
  results.push({case:'missing, both cross-tenant directions, discarded, missing linked task; legitimate B control',tenantATasks:4,tenantBTasks:1});
  console.log(JSON.stringify({boundary:'real local PostgreSQL 15.8 + PostgREST v16.1; authenticated role; independent HTTP requests',results,limits:'Ignored acknowledgement is caller discard, not a network fault. Browser reload/UI recovery is separate. Fixture DB is disposable; no hosted data.'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
