import type { Provider } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { ENTRY_RETURN_COOKIE, ENTRY_SIGN_IN_COOKIE, entryCookieOptions, requireEntryProviderIdentifier } from "@/lib/auth/entry-identity";
import { trustedWorkspaceOrigin } from "@/lib/http/origin";
import { createWorkspaceServerClient } from "@/lib/supabase/server";
import { normalizeWorkspaceReturnPath } from "@/lib/workspace/return-path";
import { createPreviewAuthorization, previewOAuthConfiguration, requirePreviewServerBoundary, PREVIEW_TRANSACTION_COOKIE } from "@/lib/auth/preview-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  let origin = "https://workspace.leademergence.com";
  try {
    origin = trustedWorkspaceOrigin(request.nextUrl.origin);
    const callback = new URL("/auth/callback/sign-in", origin);
    const returnPath = normalizeWorkspaceReturnPath(request.nextUrl.searchParams.get("next"));
    if (previewOAuthConfiguration()) {
      const { clientId } = requirePreviewServerBoundary(request.nextUrl.origin);
      const authorization = await createPreviewAuthorization(clientId);
      cookieStore.set(PREVIEW_TRANSACTION_COOKIE, authorization.transaction, entryCookieOptions("/auth/callback/sign-in"));
      cookieStore.set(ENTRY_RETURN_COOKIE, returnPath, entryCookieOptions("/"));
      return NextResponse.redirect(authorization.url, 303);
    }
    const supabase = await createWorkspaceServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: requireEntryProviderIdentifier() as Provider,
      options: { redirectTo: callback.toString(), skipBrowserRedirect: true }
    });
    if (error || !data.url) throw error ?? new Error("Entry authorization URL unavailable.");
    cookieStore.set(ENTRY_SIGN_IN_COOKIE, "sign-in", entryCookieOptions("/auth/callback/sign-in"));
    cookieStore.set(ENTRY_RETURN_COOKIE, returnPath, entryCookieOptions("/"));
    return NextResponse.redirect(data.url, 303);
  } catch {
    cookieStore.set(PREVIEW_TRANSACTION_COOKIE, "", { ...entryCookieOptions("/auth/callback/sign-in"), maxAge: 0 });
    cookieStore.set(ENTRY_SIGN_IN_COOKIE, "", { ...entryCookieOptions("/auth/callback/sign-in"), maxAge: 0 });
    return NextResponse.redirect(new URL("/login?error=entry_unavailable", origin), 303);
  }
}
