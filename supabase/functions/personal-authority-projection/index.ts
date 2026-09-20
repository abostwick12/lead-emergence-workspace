import postgres from "npm:postgres@3.4.9";
import { createPersonalAuthorityProjectionHandler, ProjectionConflictError } from "./handler.ts";

const hmacSecret = Deno.env.get("WORKSPACE_PROJECTION_HMAC_SECRET") ?? "";
const projectionDatabaseUrl = Deno.env.get("WORKSPACE_PROJECTION_DB_URL") ?? "";

if (!projectionDatabaseUrl) {
  throw new Error("Workspace projection database configuration is incomplete.");
}

const database = postgres(projectionDatabaseUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 20,
});

function databaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

const handler = createPersonalAuthorityProjectionHandler({
  secret: hmacSecret,
  apply: async (envelope) => {
    try {
      const [row] = await database`
        select workspace.apply_personal_authority_projection(
          ${envelope.protocol_version},
          ${envelope.delivery_id}::uuid,
          ${envelope.projection_kind},
          ${envelope.projection_version},
          ${envelope.canonical_user_id}::uuid,
          ${envelope.projected_at}::timestamptz,
          ${database.json(envelope.projection_data)}
        ) as result
      `;
      return row?.result;
    } catch (error) {
      if (databaseErrorCode(error) === "23505") throw new ProjectionConflictError();
      throw new Error("Projection database operation failed.");
    }
  },
});

Deno.serve(handler);
