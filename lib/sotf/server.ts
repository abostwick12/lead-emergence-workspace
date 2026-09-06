import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SotfStore, throwPersistenceError } from "./persistence";

export class SotfPilotUnavailable extends Error {
  constructor() { super("Persistent SOTF workflows are not enabled in this environment. Explore the fictional preview, or return when your pilot is activated."); }
}
export function createSotfStore(client: SupabaseClient<any, any, any, any, any>) {
  if (process.env.SOTF_PILOT_ENABLED !== "true") throw new SotfPilotUnavailable();
  return new SotfStore({
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
}
