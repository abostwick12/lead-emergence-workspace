import { NextResponse } from "next/server";
import { createWorkspaceServerClient } from "@/lib/supabase/server";

const AUTHORIZATION_ID = /^[a-z2-7]{32}$/;

async function verifiedWorkspaceRequest(authorizationId: string) {
  if (!AUTHORIZATION_ID.test(authorizationId)) return null;
  const supabase = await createWorkspaceServerClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) return null;
  const { data: product, error: productError } = await supabase.rpc("resolve_oauth_consent_product", {
    p_authorization_id: authorizationId
  });
  return productError || product !== "workspace" ? null : { supabase, user: userResult.user };
}

async function activeWorkspaceMcpAccess(
  supabase: Awaited<ReturnType<typeof createWorkspaceServerClient>>,
  userId: string
): Promise<boolean> {
  const { data: workspace, error: workspaceError } = await supabase.rpc("ensure_personal_workspace").single<{
    id: string; owner_user_id: string; workspace_type: string;
  }>();
  if (workspaceError || !workspace || workspace.owner_user_id !== userId || workspace.workspace_type !== "personal") return false;
  const { data: plan, error: planError } = await supabase.from("personal_plans")
    .select("plan_key,status").eq("workspace_id", workspace.id).single();
  if (planError || !plan || plan.status !== "active") return false;
  const { data: capability, error: capabilityError } = await supabase.from("plan_capabilities")
    .select("enabled").eq("plan_key", plan.plan_key).eq("capability_key", "workspace_mcp").single();
  return !capabilityError && capability?.enabled === true;
}

export async function GET(request: Request) {
  const authorizationId = new URL(request.url).searchParams.get("authorization_id") ?? "";
  const verified = await verifiedWorkspaceRequest(authorizationId);
  if (!verified) return NextResponse.json({ error: "This Workspace authorization request is not available." }, { status: 403 });
  if (!await activeWorkspaceMcpAccess(verified.supabase, verified.user.id)) {
    return NextResponse.json({ error: "The current Personal plan cannot authorize this connection.", canDeny: true }, { status: 403 });
  }
  const { data, error } = await verified.supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) return NextResponse.json({ error: "This authorization request is no longer available." }, { status: 400 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  let input: unknown;
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "A connection decision is required." }, { status: 400 }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "Invalid connection decision." }, { status: 400 });
  }
  const fields = input as Record<string, unknown>;
  const authorizationId = typeof fields.authorizationId === "string" ? fields.authorizationId : "";
  const decision = fields.decision;
  if (decision !== "approve" && decision !== "deny") {
    return NextResponse.json({ error: "Invalid connection decision." }, { status: 400 });
  }
  const verified = await verifiedWorkspaceRequest(authorizationId);
  if (!verified) return NextResponse.json({ error: "This Workspace authorization request is not available." }, { status: 403 });

  if (decision === "approve" && !await activeWorkspaceMcpAccess(verified.supabase, verified.user.id)) {
    return NextResponse.json({ error: "The current Personal plan cannot authorize this connection." }, { status: 403 });
  }

  const result = decision === "approve"
    ? await verified.supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
    : await verified.supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
  if (result.error || !result.data?.redirect_url || !safeOAuthRedirect(result.data.redirect_url)) {
    return NextResponse.json({ error: "The authorization decision could not be completed safely." }, { status: 400 });
  }
  return NextResponse.json({ redirect_url: result.data.redirect_url }, { headers: { "Cache-Control": "no-store" } });
}

function safeOAuthRedirect(value: string) {
  try {
    const destination = new URL(value);
    return destination.protocol === "https:" || (destination.protocol === "http:" && ["localhost", "127.0.0.1"].includes(destination.hostname));
  } catch { return false; }
}
