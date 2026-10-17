import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { ENTRY_RETURN_COOKIE, ENTRY_SIGN_IN_COOKIE, entryCookieOptions, verifyEntryProviderIdentity } from "@/lib/auth/entry-identity";
import { trustedWorkspaceOrigin } from "@/lib/http/origin";
import { createWorkspaceServerClient } from "@/lib/supabase/server";
import { normalizeWorkspaceReturnPath } from "@/lib/workspace/return-path";
import { consumePreviewTransaction, exchangePreviewCode, previewOAuthConfiguration, requirePreviewServerBoundary, verifyPreviewClaims, PREVIEW_TRANSACTION_COOKIE } from "@/lib/auth/preview-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  let origin = "https://workspace.leademergence.com";
  const mode = cookieStore.get(ENTRY_SIGN_IN_COOKIE)?.value;
  const returnPath = normalizeWorkspaceReturnPath(cookieStore.get(ENTRY_RETURN_COOKIE)?.value);
  const transaction = cookieStore.get(PREVIEW_TRANSACTION_COOKIE)?.value;
  cookieStore.set(PREVIEW_TRANSACTION_COOKIE, "", { ...entryCookieOptions("/auth/callback/sign-in"), maxAge: 0 });
  cookieStore.set(ENTRY_SIGN_IN_COOKIE, "", { ...entryCookieOptions("/auth/callback/sign-in"), maxAge: 0 });
  cookieStore.set(ENTRY_RETURN_COOKIE, "", { ...entryCookieOptions("/"), maxAge: 0 });
  const supabase = await createWorkspaceServerClient();

  try {
    origin = trustedWorkspaceOrigin(request.nextUrl.origin);
    if (request.nextUrl.searchParams.get("error")) throw new Error("Entry sign-in was not approved.");
    const code = request.nextUrl.searchParams.get("code");
    if (!code) throw new Error("Entry sign-in code is missing.");
    const preview = previewOAuthConfiguration();
    let canonicalUserId: string | null = null;
    if (preview) {
      const configuration = requirePreviewServerBoundary(request.nextUrl.origin);
      const { clientId } = configuration;
      const verifier = consumePreviewTransaction(transaction, request.nextUrl.searchParams.get("state"), clientId);
      const tokens = await exchangePreviewCode(code, verifier, configuration);
      const verified = await supabase.auth.getClaims(tokens.access_token);
      if (verified.error || !verified.data) throw new Error("Preview token verification failed.");
      canonicalUserId = verifyPreviewClaims(verified.data.claims, clientId);
      const installed = await supabase.auth.setSession(tokens);
      if (installed.error) throw installed.error;
    } else {
      if (mode !== "sign-in") throw new Error("Entry sign-in was not approved.");
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
    }
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) throw userError ?? new Error("Entry identity is unavailable.");
    if (preview) {
      if (data.user.id !== canonicalUserId) throw new Error("Preview user identity mismatch.");
    } else {
      verifyEntryProviderIdentity(data.user);
    }
    const provisioned = await supabase.rpc("ensure_personal_workspace");
    if (provisioned.error) throw provisioned.error;
    return NextResponse.redirect(new URL(returnPath, origin), 303);
  } catch {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(new URL("/login?error=entry_denied", origin), 303);
  }
}
