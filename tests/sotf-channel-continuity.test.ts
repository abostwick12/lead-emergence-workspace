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
async function connect(sotfEnabled = true) {
  const [one,two] = InMemoryTransport.createLinkedPair(); const server = createWorkspaceMcpServer(transport as never, undefined, { sotfEnabled }); const client = new Client({ name: 'fictional-new-conversation', version: '1' });
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
    const client = await connect(false); const listed = await client.listTools();
    expect(listed.tools.some(tool => tool.name.startsWith('sotf_'))).toBe(false);
    expect((await GET(request())).status).toBe(503);
  });

  it('enforces authoritative scheduling configuration across native API and MCP saves', async () => {
    vi.stubEnv('SOTF_PILOT_ENABLED','true');
    vi.stubEnv('NEXT_PUBLIC_APP_URL','https://workspace.leademergence.com');
    vi.stubEnv('SOTF_NETWORKING_BOOKING_URL','');
    const batch: EventBatch = { workspace_id: '70000000-0000-4000-8000-000000000001', revision: 0, events: [] };
    transport.rpc.mockImplementation(async (name: string, args?: { operation: CommandEnvelope }) => {
      if (name === 'sotf_read_operations') return { data: structuredClone(batch), error: null };
      if (name !== 'sotf_append_operation' || !args) throw new Error('Unexpected RPC: ' + name);
      const operation = args.operation;
      if (operation.expectedRevision !== batch.revision) return { data: null, error: { code: '40001' } };
      batch.revision += 1; batch.events.push({ revision: batch.revision, envelope: operation, recorded_at: '2026-09-24T12:00:00.000Z' });
      return { data: { revision: batch.revision }, error: null };
    });
    const envelope = (command: unknown) => commandEnvelopeSchema.parse({ requestId: randomUUID(), expectedRevision: batch.revision, userConfirmed: true, dataClass: 'ordinary_transition_operations', command });
    const candidate = { id: 'scheduling-candidate', name: 'Fictional scheduling candidate', company: 'Fictional organization', role: 'Program leader', source: 'Synthetic test fixture', overlap: '', whyNow: 'Can explain the work being explored', objective: 'Learn how the work operates', introductionPath: '', hypothesisIds: [], networking: { weekOf: '2026-09-21', sourceUrl: 'https://example.org/scheduling-candidate', whyPerson: 'Direct synthetic experience', lamp: { list: 'program leadership', alumniAffinity: '', motivation: 'Relevant synthetic work', posting: '' }, contributionAngle: 'Offer a useful delivery perspective', recommendedNextAction: 'Reply with the scheduling page', pathway: 'direct_outreach', status: 'replied' } };
    expect((await POST(request(envelope({ type: 'save_person', person: candidate })))).status).toBe(200);
    expect(batch).toMatchObject({ revision: 1, events: [{ envelope: { command: { type: 'save_person' } } }] });

    const plausibleCallerUrl = 'https://workspace.leademergence.com/meet/andrew';
    const missingNative = await POST(request(envelope({ type: 'prepare_scheduling_reply', personId: candidate.id, schedulingUrl: plausibleCallerUrl })));
    expect(missingNative.status).toBe(400);
    expect(await missingNative.json()).toMatchObject({ saved: false, message: expect.stringContaining('not configured') });
    expect(batch).toMatchObject({ revision: 1 });
    expect(batch.events).toHaveLength(1);
    expect(await (await GET(request())).json()).toMatchObject({ state: { revision: 1, actions: [] } });

    const client = await connect();
    const missingMcp = await client.callTool({ name: 'sotf_record_transition_step', arguments: envelope({ type: 'prepare_scheduling_reply', personId: candidate.id, schedulingUrl: plausibleCallerUrl }) });
    expect(missingMcp.isError).toBe(true);
    expect(JSON.stringify(missingMcp.content)).toContain('not configured');
    expect(batch).toMatchObject({ revision: 1 });
    expect(batch.events).toHaveLength(1);

    vi.stubEnv('SOTF_NETWORKING_BOOKING_URL','https://calendar.app.google/syntheticAuthoritativeBooking');
    const callerControlledUrl = 'https://attacker.example/meet/andrew';
    const configured = await POST(request(envelope({ type: 'prepare_scheduling_reply', personId: candidate.id, schedulingUrl: callerControlledUrl })));
    expect(configured.status).toBe(200);
    const configuredBody = await configured.json();
    expect(configuredBody).toMatchObject({ saved: true, state: { revision: 2, actions: [{ state: 'draft', body: expect.stringContaining(plausibleCallerUrl) }] } });
    expect(configuredBody.state.actions[0].body).not.toContain(callerControlledUrl);
    expect(configuredBody.state.actions[0].body).not.toContain('calendar.app.google');
    expect(batch.events).toHaveLength(2);
    expect(batch.events[1].envelope.command).toMatchObject({ type: 'prepare_scheduling_reply', schedulingUrl: plausibleCallerUrl });
  });
});
