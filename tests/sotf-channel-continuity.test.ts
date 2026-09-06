import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const transport = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/workspace/bundle-server', async () => {
  const actual = await vi.importActual<typeof import('@/lib/workspace/bundle-server')>('@/lib/workspace/bundle-server');
  return { ...actual, authenticatedBundleClient: vi.fn(async (token: string) => { if (token !== 'synthetic-local-session') throw new actual.BundleApiError('Use shared sign-in.',401); return { client: transport, user: { id: 'fictional-user' } }; }) };
});
import { GET, POST } from '@/app/api/sotf/route';
import { createWorkspaceMcpServer } from '@/lib/workspace/mcp-server';
import { commandEnvelopeSchema, type CommandEnvelope } from '@/lib/sotf/contracts';
import type { EventBatch } from '@/lib/sotf/persistence';
const closeables: Array<{ close: () => Promise<void> }> = [];
afterEach(async () => { vi.unstubAllEnvs(); await Promise.all(closeables.splice(0).map(item => item.close())); });
async function connect() {
  const [one,two] = InMemoryTransport.createLinkedPair(); const server = createWorkspaceMcpServer(transport as never); const client = new Client({ name: 'fictional-new-conversation', version: '1' });
  await server.connect(two); await client.connect(one); closeables.push(server,client); return client;
}
const request = (operation?: CommandEnvelope) => new Request('http://localhost/api/sotf', { method: operation ? 'POST' : 'GET', headers: { authorization: 'Bearer synthetic-local-session', 'content-type': 'application/json' }, body: operation ? JSON.stringify(operation) : undefined });
describe('SOTF native API and new MCP conversation share one operational history', () => {
  it('resumes a native decision through MCP and recovers a lost save reply without duplicate events', async () => {
    vi.stubEnv('SOTF_PILOT_ENABLED','true');
    const batch: EventBatch = { workspace_id: '70000000-0000-4000-8000-000000000001', revision: 0, events: [] }; let loseReply = false;
    transport.rpc.mockImplementation(async (name: string, args?: { operation: CommandEnvelope }) => {
      if (name === 'sotf_read_operations') return { data: structuredClone(batch), error: null };
      if (name !== 'sotf_append_operation' || !args) throw new Error('Unexpected RPC: ' + name);
      const operation = args.operation;
      if (operation.expectedRevision !== batch.revision) return { data: null, error: { code: '40001' } };
      batch.revision += 1; batch.events.push({ revision: batch.revision, envelope: operation, recorded_at: '2026-09-06T12:00:00.000Z' });
      if (loseReply) { loseReply = false; return { data: null, error: { code: 'network' } }; }
      return { data: { revision: batch.revision }, error: null };
    });
    const envelope = (command: unknown) => commandEnvelopeSchema.parse({ requestId: randomUUID(), expectedRevision: batch.revision, userConfirmed: true, dataClass: 'ordinary_transition_operations', command });
    expect((await POST(request(envelope({ type: 'start_transition', timing: 'Six months', question: 'Which work gives me ownership?', weeklyHours: 6, criteria: [], hypotheses: [] })))).status).toBe(200);
    expect((await POST(request(envelope({ type: 'record_opportunity', opportunity: { id: 'fictional-role', company: 'Fictional Northstar', role: 'Program Lead' } })))).status).toBe(200);
    const client = await connect();
    const resumed = await client.callTool({ name: 'sotf_resume_transition', arguments: {} });
    expect(resumed.structuredContent).toMatchObject({ revision: 2, chapter: { question: 'Which work gives me ownership?' } });
    const decision = envelope({ type: 'decide_opportunity', opportunityId: 'fictional-role', decision: 'investigate', rationale: 'Authority is unresolved', nextAction: 'Ask a practitioner about owned decisions', revisitWhen: 'After the conversation' });
    await client.callTool({ name: 'sotf_record_transition_step', arguments: decision });
    expect(await (await GET(request())).json()).toMatchObject({ state: { revision: 3, opportunities: [{ decision: { nextAction: 'Ask a practitioner about owned decisions' } }] } });
    const changed = envelope({ type: 'decide_opportunity', opportunityId: 'fictional-role', decision: 'pause', rationale: 'Wait for direct evidence', nextAction: 'Follow up with the practitioner', revisitWhen: 'A reply arrives' });
    loseReply = true;
    expect(await (await POST(request(changed))).json()).toMatchObject({ saved: null });
    const anotherConversation = await connect();
    const retry = await anotherConversation.callTool({ name: 'sotf_record_transition_step', arguments: changed });
    expect(retry.isError).not.toBe(true); expect(retry.structuredContent).toMatchObject({ saved: true, replayed: true, revision: 4 });
    expect(batch.events).toHaveLength(4);
  });
  it('keeps the pilot unavailable when its environment flag is off', async () => {
    vi.stubEnv('SOTF_PILOT_ENABLED','false');
    const client = await connect(); const listed = await client.listTools();
    expect(listed.tools.some(tool => tool.name.startsWith('sotf_'))).toBe(false);
    expect((await GET(request())).status).toBe(503);
  });
});
