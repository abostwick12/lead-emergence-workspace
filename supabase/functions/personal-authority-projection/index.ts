// The Edge Function is intentionally the only Workspace runtime containing the
// service credential. The normal Next.js application never imports this file.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createPersonalAuthorityProjectionHandler } from "./handler.ts";

const hmacSecret = Deno.env.get("WORKSPACE_PROJECTION_HMAC_SECRET") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Workspace projection database configuration is incomplete.");
}

const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  db: { schema: "workspace" },
});

const handler = createPersonalAuthorityProjectionHandler({
  secret: hmacSecret,
  apply: async (envelope) => {
    const { data, error } = await service.rpc("apply_personal_authority_projection", {
      p_protocol_version: envelope.protocol_version,
      p_delivery_id: envelope.delivery_id,
      p_projection_kind: envelope.projection_kind,
      p_projection_version: envelope.projection_version,
      p_canonical_user_id: envelope.canonical_user_id,
      p_projected_at: envelope.projected_at,
      p_projection_data: envelope.projection_data,
    });
    if (error) throw new Error("Normalized projection RPC rejected the message.");
    return data;
  },
});

Deno.serve(handler);
