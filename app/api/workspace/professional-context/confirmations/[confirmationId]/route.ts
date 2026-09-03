import { NextRequest, NextResponse } from "next/server";
import * as z from "zod/v4";
import { createWorkspaceServerClient } from "@/lib/supabase/server";
import {
  assertFirstPartyProfessionalContextMutation,
  createProfessionalContextCsrfToken,
  professionalContextCsrfCookie,
  professionalContextCsrfCookieOptions,
  ProfessionalContextRequestError,
} from "@/lib/workspace/professional-context-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const confirmationIdSchema = z.uuid();
const mutationSchema = z.strictObject({
  action: z.enum(["confirm", "deny"]),
  csrfToken: z.string().min(32).max(128),
  correctedLabel: z.string().trim().min(1).max(240).nullable().optional(),
  correctedSummary: z.string().trim().min(1).max(5000).nullable().optional(),
});

type ConfirmationRouteContext = { params: Promise<{ confirmationId: string }> };

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
    return noStore(NextResponse.json({ message: "The confirmation request is invalid." }, { status: 400 }));
  }
  const databaseError = error as { code?: string; message?: string };
  const status = databaseError?.code === "42501" ? 403 : databaseError?.code === "PGRST116" ? 404 : 400;
  return noStore(NextResponse.json({ message: databaseError?.message || "The confirmation is unavailable." }, { status }));
}

async function authenticatedDirectClient() {
  const client = await createWorkspaceServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new ProfessionalContextRequestError("Sign in to review this request.", 401);
  return client;
}

export async function GET(request: NextRequest, context: ConfirmationRouteContext) {
  try {
    if (request.headers.has("authorization")) {
      throw new ProfessionalContextRequestError("Bearer authorization cannot load confirmation previews.", 403);
    }
    const { confirmationId: rawId } = await context.params;
    const confirmationId = confirmationIdSchema.parse(rawId);
    const client = await authenticatedDirectClient();
    const { data, error } = await client.rpc("get_professional_context_confirmation", {
      target_request_id: confirmationId,
    });
    if (error) throw error;
    const csrfToken = createProfessionalContextCsrfToken();
    const cookiePath = `/api/workspace/professional-context/confirmations/${confirmationId}`;
    const response = noStore(NextResponse.json({ confirmation: data, csrfToken }));
    response.cookies.set(
      professionalContextCsrfCookie,
      csrfToken,
      professionalContextCsrfCookieOptions(cookiePath),
    );
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, context: ConfirmationRouteContext) {
  try {
    const { confirmationId: rawId } = await context.params;
    const confirmationId = confirmationIdSchema.parse(rawId);
    const input = mutationSchema.parse(await request.json());
    assertFirstPartyProfessionalContextMutation(
      request,
      input.csrfToken,
      request.cookies.get(professionalContextCsrfCookie)?.value,
    );
    const client = await authenticatedDirectClient();
    const rpcName = input.action === "confirm"
      ? "confirm_and_execute_professional_context"
      : "deny_professional_context_confirmation";
    const parameters = input.action === "confirm"
      ? {
          target_request_id: confirmationId,
          final_corrected_label: input.correctedLabel ?? null,
          final_corrected_summary: input.correctedSummary ?? null,
        }
      : { target_request_id: confirmationId };
    const { data, error } = await client.rpc(rpcName, parameters);
    if (error) throw error;
    const response = noStore(NextResponse.json({ confirmation: data }));
    response.cookies.set(professionalContextCsrfCookie, "", {
      ...professionalContextCsrfCookieOptions(`/api/workspace/professional-context/confirmations/${confirmationId}`),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
