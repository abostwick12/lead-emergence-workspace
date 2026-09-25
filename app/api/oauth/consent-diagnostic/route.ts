import { createWorkspaceServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeCode = /^[a-z][a-z0-9_]{0,63}$/;
const stages = {
  allow_started: { sequence: 0, required: [], optional: [] },
  approval_attempted: { sequence: 1, required: [], optional: [] },
  approval_result: { sequence: 2, required: ["outcome", "redirect_kind"], optional: ["error_code", "error_type", "error_status"] },
  approval_exception: { sequence: 2, required: ["error_code", "error_type"], optional: ["error_status"] },
  redirect_selected: { sequence: 3, required: ["branch"], optional: [] },
} as const;

type Stage = keyof typeof stages;
type Diagnostic = Record<string, unknown> & { attempt_id: string; stage: Stage };

function isDiagnostic(value: unknown): value is Diagnostic {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  if (typeof event.stage !== "string" || !Object.prototype.hasOwnProperty.call(stages, event.stage)) return false;
  const shape = stages[event.stage as Stage];
  const permitted = new Set<string>(["attempt_id", "sequence", "stage", "client_id", ...shape.required, ...shape.optional]);
  if (Object.keys(event).some((key) => !permitted.has(key))) return false;
  if (shape.required.some((key) => !(key in event))) return false;
  if (event.sequence !== shape.sequence) return false;
  if (typeof event.attempt_id !== "string" || !uuid.test(event.attempt_id)) return false;
  if (event.client_id !== undefined && (typeof event.client_id !== "string" || !uuid.test(event.client_id))) return false;
  if (event.outcome !== undefined && !["success", "error"].includes(String(event.outcome))) return false;
  if (event.redirect_kind !== undefined && !["authorization_code", "oauth_error", "other", "missing", "unsafe"].includes(String(event.redirect_kind))) return false;
  if (event.branch !== undefined && !["oauth_redirect", "stay_on_error", "login_redirect", "already_authorized_redirect"].includes(String(event.branch))) return false;
  if (event.error_code !== undefined && (typeof event.error_code !== "string" || !safeCode.test(event.error_code))) return false;
  if (event.error_type !== undefined && !["AuthApiError", "AuthRetryableFetchError", "AuthSessionMissingError", "AuthUnknownError", "TypeError", "Error", "OtherError"].includes(String(event.error_type))) return false;
  if (event.error_status !== undefined && (!Number.isInteger(event.error_status) || Number(event.error_status) < 400 || Number(event.error_status) > 599)) return false;
  if (event.stage === "approval_result" && (event.outcome === "error") !== (event.error_code !== undefined)) return false;
  if (event.stage === "approval_result" && (event.outcome === "error") !== (event.error_type !== undefined)) return false;
  return true;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return new Response(null, { status: 403 });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return new Response(null, { status: 415 });
  }
  let userId: string;
  try {
    const supabase = await createWorkspaceServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || !uuid.test(data.user.id)) return new Response(null, { status: 401 });
    userId = data.user.id;
  } catch {
    return new Response(null, { status: 401 });
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > 512) return new Response(null, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 512) { await reader.cancel(); return new Response(null, { status: 413 }); }
    chunks.push(value);
  }
  const body = new TextDecoder().decode(Buffer.concat(chunks));
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!isDiagnostic(payload)) return new Response(null, { status: 400 });

  // Only this validated, non-secret shape reaches Vercel runtime logs.
  console.info("workspace_oauth_consent_diagnostic", { ...payload, user_id: userId });
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
