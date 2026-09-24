import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { networkingBookingConfiguration } from "./booking";
import { commandEnvelopeSchema } from "./contracts";
import { OperationNotApplied, SotfStore, throwPersistenceError } from "./persistence";

export class SotfPilotUnavailable extends Error {
  constructor() { super("Persistent SOTF workflows are not enabled in this environment. Explore the fictional preview, or return when your pilot is activated."); }
}
function authoritativeOperation(input: unknown) {
  const envelope = commandEnvelopeSchema.parse(input);
  if (envelope.command.type !== "prepare_scheduling_reply") return envelope;
  const booking = networkingBookingConfiguration();
  if (booking.status === "unavailable") throw new OperationNotApplied(booking.message);
  return commandEnvelopeSchema.parse({ ...envelope, command: { ...envelope.command, schedulingUrl: booking.publicUrl } });
}
export function createSotfStore(client: SupabaseClient<any, any, any, any, any>) {
  if (process.env.SOTF_PILOT_ENABLED !== "true") throw new SotfPilotUnavailable();
  const store = new SotfStore({
    async read() {
      const { data, error } = await client.rpc("sotf_read_operations");
      if (error) throwPersistenceError(error);
      return data;
    },
    async append(operation) {
      const { data, error } = await client.rpc("sotf_append_operation", { operation });
      if (error) throwPersistenceError(error);
      return data;
    }
  });
  return { read: () => store.read(), execute: (input: unknown) => store.execute(authoritativeOperation(input)) };
}
