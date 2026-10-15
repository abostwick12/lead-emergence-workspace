import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { previewBrowserConfiguration, previewSessionFetch, PREVIEW_SESSION_COOKIE } from "@/lib/auth/preview-oauth";

export async function updateWorkspaceSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const preview = previewBrowserConfiguration();
  const acceptSession = !preview || process.env.ENTRY_PREVIEW_APPROVED_ORIGIN === preview.origin;
  const supabase = createServerClient(url, key, {
    db: { schema: process.env.NEXT_PUBLIC_WORKSPACE_SCHEMA?.trim() || "workspace" },
    global: { fetch: previewSessionFetch(preview) },
    cookieOptions: { secure: process.env.NODE_ENV === "production", ...(preview ? { name: PREVIEW_SESSION_COOKIE } : {}) },
    cookies: {
      getAll: () => acceptSession ? request.cookies.getAll() : [],
      setAll(cookiesToSet, headers) {
        if (!acceptSession) return;
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      }
    }
  });
  await supabase.auth.getClaims();
  return response;
}
