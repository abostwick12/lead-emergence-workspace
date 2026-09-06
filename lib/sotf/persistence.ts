import { z } from "zod";
import { commandEnvelopeSchema, emptyPilotState, type CommandEnvelope, type PilotState } from "./contracts";
import { applyCommand, RevisionConflict } from "./engine";

const eventSchema = z.strictObject({
  revision: z.number().int().positive(),
  recorded_at: z.string().datetime({ offset: true }),
  envelope: commandEnvelopeSchema
});
export const eventBatchSchema = z.strictObject({ workspace_id: z.string().uuid(), revision: z.number().int().nonnegative(), events: z.array(eventSchema).max(2000) });
export type EventBatch = z.infer<typeof eventBatchSchema>;
export type WorkflowEvent = z.infer<typeof eventSchema>;

/** Rebuild from the ordered canonical log, rather than trusting caller-written state snapshots. */
export function replayEvents(input: unknown): { workspaceId: string; state: PilotState } {
  const batch = eventBatchSchema.parse(input);
  let state = emptyPilotState();
  for (const event of batch.events) {
    if (event.revision !== state.revision + 1 || event.envelope.expectedRevision !== state.revision) {
      throw new Error("The transition history is incomplete or out of order. Existing work is preserved; contact pilot support before writing more changes.");
    }
    state = applyCommand(state, event.envelope, event.recorded_at);
    if (state.revision !== event.revision) throw new Error("The transition history contains a duplicate operation. Review it before continuing.");
  }
  if (state.revision !== batch.revision) throw new Error("The transition history did not load completely. Refresh before continuing.");
  return { workspaceId: batch.workspace_id, state };
}

export interface SotfTransport {
  read(): Promise<unknown>;
  append(envelope: CommandEnvelope): Promise<unknown>;
}

/** No append was attempted, or the database explicitly rejected the transaction. */
export class OperationNotApplied extends Error {
  constructor(message: string) { super(message); this.name = "OperationNotApplied"; }
}

/** Shared native/MCP behavior. A successful reply proves the saved event was read back. */
export class SotfStore {
  constructor(private readonly transport: SotfTransport, private readonly clock = () => new Date().toISOString()) {}
  async read() { return replayEvents(await this.transport.read()); }
  async execute(input: unknown) {
    const envelope = commandEnvelopeSchema.parse(input);
    let before: Awaited<ReturnType<SotfStore["read"]>>;
    let proposed: PilotState;
    try {
      before = await this.read();
      proposed = applyCommand(before.state, envelope, this.clock());
    } catch (error) {
      if (error instanceof RevisionConflict) throw error;
      throw new OperationNotApplied(error instanceof Error ? error.message : "The step could not be checked. Nothing was saved.");
    }
    if (proposed === before.state) return { ...before, replayed: true };
    await this.transport.append(envelope);
    let after: Awaited<ReturnType<SotfStore["read"]>>;
    try { after = await this.read(); }
    catch { throw new Error("The change may have been saved, but its result could not be read back. Verify the same operation before retrying."); }
    const receipt = after.state.receipts.find((item) => item.requestId === envelope.requestId);
    if (!receipt || receipt.command !== JSON.stringify(envelope.command)) throw new Error("The save result is uncertain. Refresh with the same request ID before retrying; do not create a duplicate operation.");
    return { ...after, replayed: false };
  }
}

export function throwPersistenceError(error: { code?: string; message?: string }): never {
  if (error.code === "40001") throw new RevisionConflict();
  if (error.code === "42501") throw new OperationNotApplied("This SOTF Bundle connection or pilot access is unavailable. Reconnect or review your access before continuing.");
  if (error.code === "P0002" || error.code === "42883" || error.code === "PGRST202") throw new OperationNotApplied("Persistent SOTF workflows have not been enabled in this environment. The preview remains available with fictional data.");
  throw new Error("SOTF Bundle could not verify the persistence result. Refresh before retrying the same operation.");
}
