import type { Provider } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { ENTRY_RETURN_COOKIE, ENTRY_SIGN_IN_COOKIE, entryCookieOptions, requireEntryProviderIdentifier } from "@/lib/auth/entry-identity";
import { trustedWorkspaceOrigin } from "@/lib/http/origin";
import { createWorkspaceServerClient } from "@/lib/supabase/server";
import { normalizeWorkspaceReturnPath } from "@/lib/workspace/return-path";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  let origin = "https://workspace.leademergence.com";
  try {
    origin = trustedWorkspaceOrigin(request.nextUrl.origin);
    const callback = new URL("/auth/callback/sign-in", origin);
    const returnPath = normalizeWorkspaceReturnPath(request.nextUrl.searchParams.get("next"));
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
    cookieStore.set(ENTRY_SIGN_IN_COOKIE, "", { ...entryCookieOptions("/auth/callback/sign-in"), maxAge: 0 });
    return NextResponse.redirect(new URL("/login?error=entry_unavailable", origin), 303);
  }
}
