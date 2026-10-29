import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { randomUUID } from "node:crypto";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { commandEnvelopeSchema } from "../lib/sotf/contracts";
import type { EventBatch } from "../lib/sotf/persistence";
import { createWorkspaceMcpServer } from "../lib/workspace/mcp-server";

const closeables: Array<{ close: () => Promise<void> }> = [];
afterEach(async () => {
  await Promise.all(closeables.splice(0).map((item) => item.close()));
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

test("MCP networking preparation defaults to the current Chicago week and honors an explicit older week", async () => {
  vi.stubEnv("SOTF_PILOT_ENABLED", "true");
  vi.useFakeTimers({ toFake: ["Date"] });
  // Monday UTC is still Sunday in Chicago.
  vi.setSystemTime(new Date("2026-10-19T04:30:00Z"));

  const weeks = ["2026-10-05", "2026-10-12", "2026-10-19"];
  const events = weeks.map((weekOf, index) => ({
    revision: index + 1,
    recorded_at: `2026-10-${String(5 + index * 7).padStart(2, "0")}T12:00:00.000Z`,
    envelope: commandEnvelopeSchema.parse({
      requestId: randomUUID(), expectedRevision: index, userConfirmed: true,
      dataClass: "ordinary_transition_operations",
      command: { type: "save_person", person: {
        id: `synthetic-person-${index}`, name: `Synthetic person ${index}`, company: "Fictional company",
        role: "Program leader", source: "Synthetic test", overlap: "", whyNow: "Learn about the work",
        objective: "Understand the role", introductionPath: "", hypothesisIds: [],
        networking: { weekOf, sourceUrl: "https://example.org/person", whyPerson: "Relevant experience",
          lamp: { list: "program leadership", alumniAffinity: "", motivation: "Relevant work", posting: "" },
          contributionAngle: "Share a perspective", recommendedNextAction: "Prepare a conversation",
          pathway: "direct_outreach", status: "identified" }
      } }
    })
  }));
  const batch: EventBatch = { workspace_id: "70000000-0000-4000-8000-000000000001", revision: events.length, events };
  const rpc = vi.fn(async (name: string) => {
    if (name !== "sotf_read_operations") throw new Error(`Unexpected RPC: ${name}`);
    return { data: structuredClone(batch), error: null };
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createWorkspaceMcpServer({ rpc } as never, undefined, { sotfEnabled: true });
  const client = new Client({ name: "synthetic-networking-test", version: "1" });
  closeables.push(server, client);
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const current = await client.callTool({ name: "sotf_prepare_next_move", arguments: { workflow: "networking" } });
  expect(current.isError).not.toBe(true);
  expect(current.structuredContent).toMatchObject({ workflow: "networking", revision: 3, prepared: { weekOf: "2026-10-12", queued: 1 } });
  const older = await client.callTool({ name: "sotf_prepare_next_move", arguments: { workflow: "networking", recordId: "2026-10-05" } });
  expect(older.isError).not.toBe(true);
  expect(older.structuredContent).toMatchObject({ workflow: "networking", revision: 3, prepared: { weekOf: "2026-10-05", queued: 1 } });
  expect(rpc).toHaveBeenCalledTimes(2);
});
