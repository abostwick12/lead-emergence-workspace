import { NextRequest, NextResponse } from "next/server";
import * as z from "zod/v4";
import { createWorkspaceServerClient } from "@/lib/supabase/server";
import {
  activeProfessionalContextReadGrants,
  professionalContextGrantMutationSchema,
  type ProfessionalContextAssistantConnection,
} from "@/lib/workspace/professional-context-read-grants";
import {
  assertFirstPartyProfessionalContextMutation,
  createProfessionalContextCsrfToken,
  professionalContextCsrfCookie,
  professionalContextCsrfCookieOptions,
  ProfessionalContextRequestError,
} from "@/lib/workspace/professional-context-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const endpointPath = "/api/workspace/professional-context/read-grants";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function errorResponse(error: unknown) {
  if (error instanceof ProfessionalContextRequestError) {
    return noStore(NextResponse.json({ message: error.message }, { status: error.status }));
  }
  if (error instanceof z.ZodError) {
    return noStore(NextResponse.json({ message: "The protected-read request is invalid." }, { status: 400 }));
  }
  const databaseError = error as { code?: string; message?: string };
  const status = databaseError?.code === "42501" ? 403 : databaseError?.code === "PGRST116" ? 404 : 400;
  return noStore(NextResponse.json({ message: databaseError?.message || "Protected-read access is unavailable." }, { status }));
}

async function authenticatedDirectClient() {
  const client = await createWorkspaceServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new ProfessionalContextRequestError("Sign in to manage protected reads.", 401);
  return { client, userId: data.user.id };
}

async function loadAuthoritativeState(
  client: Awaited<ReturnType<typeof createWorkspaceServerClient>>,
  userId: string,
) {
  const [authorizationResult, grantResult] = await Promise.all([
    client
      .from("mcp_authorizations")
      .select("id, client_id, assistant_provider")
      .eq("created_by", userId)
      .eq("status", "connected")
      .order("updated_at", { ascending: false }),
    client.rpc("list_professional_context_read_grants"),
  ]);
  if (authorizationResult.error) throw authorizationResult.error;
  if (grantResult.error) throw grantResult.error;

  const connections = (authorizationResult.data ?? []).map((record: {
    id: string;
    client_id: string;
    assistant_provider: "chatgpt" | "claude" | "other";
  }): ProfessionalContextAssistantConnection => ({
    id: record.id,
    clientId: record.client_id,
    assistantProvider: record.assistant_provider,
  }));
  const connectedClientIds = new Set(connections.map((connection) => connection.clientId));
  const grants = activeProfessionalContextReadGrants(grantResult.data)
    .filter((grant) => connectedClientIds.has(grant.client_id));
  return { connections, grants };
}

function stateResponse(
  state: Awaited<ReturnType<typeof loadAuthoritativeState>>,
  csrfToken: string,
) {
  const response = noStore(NextResponse.json({ ...state, csrfToken }));
  response.cookies.set(
    professionalContextCsrfCookie,
    csrfToken,
    professionalContextCsrfCookieOptions(endpointPath),
  );
  return response;
}

export async function GET(request: NextRequest) {
  try {
    if (request.headers.has("authorization")) {
      throw new ProfessionalContextRequestError("Bearer authorization cannot manage protected reads.", 403);
    }
    const { client, userId } = await authenticatedDirectClient();
    const state = await loadAuthoritativeState(client, userId);
    return stateResponse(state, createProfessionalContextCsrfToken());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = professionalContextGrantMutationSchema.parse(await request.json());
    assertFirstPartyProfessionalContextMutation(
      request,
      input.csrfToken,
      request.cookies.get(professionalContextCsrfCookie)?.value,
    );
    const { client, userId } = await authenticatedDirectClient();
    const result = input.action === "grant"
      ? await client.rpc("create_professional_context_read_grant", {
          target_client_id: input.clientId,
          target_privacy_scope: input.privacyScope,
        })
      : await client.rpc("revoke_professional_context_read_grant", {
          target_grant_id: input.grantId,
        });
    if (result.error) throw result.error;
    const state = await loadAuthoritativeState(client, userId);
    return stateResponse(state, input.csrfToken);
  } catch (error) {
    return errorResponse(error);
  }
}
