import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { ENTRY_RETURN_COOKIE, ENTRY_SIGN_IN_COOKIE, entryCookieOptions, verifyEntryProviderIdentity } from "@/lib/auth/entry-identity";
import { trustedWorkspaceOrigin } from "@/lib/http/origin";
import { createWorkspaceServerClient } from "@/lib/supabase/server";
import { normalizeWorkspaceReturnPath } from "@/lib/workspace/return-path";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  let origin = "https://workspace.leademergence.com";
  const mode = cookieStore.get(ENTRY_SIGN_IN_COOKIE)?.value;
  const returnPath = normalizeWorkspaceReturnPath(cookieStore.get(ENTRY_RETURN_COOKIE)?.value);
  cookieStore.set(ENTRY_SIGN_IN_COOKIE, "", { ...entryCookieOptions("/auth/callback/sign-in"), maxAge: 0 });
  cookieStore.set(ENTRY_RETURN_COOKIE, "", { ...entryCookieOptions("/"), maxAge: 0 });
  const supabase = await createWorkspaceServerClient();

  try {
    origin = trustedWorkspaceOrigin(request.nextUrl.origin);
    if (mode !== "sign-in" || request.nextUrl.searchParams.get("error")) throw new Error("Entry sign-in was not approved.");
    const code = request.nextUrl.searchParams.get("code");
    if (!code) throw new Error("Entry sign-in code is missing.");
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) throw userError ?? new Error("Entry identity is unavailable.");
    verifyEntryProviderIdentity(data.user);
    const provisioned = await supabase.rpc("ensure_personal_workspace");
    if (provisioned.error) throw provisioned.error;
    return NextResponse.redirect(new URL(returnPath, origin), 303);
  } catch {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(new URL("/login?error=entry_denied", origin), 303);
  }
}
