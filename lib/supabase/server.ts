import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { previewBrowserConfiguration, previewSessionFetch, PREVIEW_SESSION_COOKIE } from "@/lib/auth/preview-oauth";

function publicConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error("Workspace Supabase public configuration is unavailable.");
  return { url, key, schema: process.env.NEXT_PUBLIC_WORKSPACE_SCHEMA?.trim() || "workspace" };
}

export async function createWorkspaceServerClient(): Promise<SupabaseClient<any, any, any, any, any>> {
  const { url, key, schema } = publicConfiguration();
  const cookieStore = await cookies();
  const preview = previewBrowserConfiguration();
  const acceptSession = !preview || process.env.ENTRY_PREVIEW_APPROVED_ORIGIN === preview.origin;
  return createServerClient(url, key, {
    db: { schema },
    global: { fetch: previewSessionFetch(preview) },
    cookieOptions: { secure: process.env.NODE_ENV === "production", ...(preview ? { name: PREVIEW_SESSION_COOKIE } : {}) },
    cookies: {
      getAll: () => acceptSession ? cookieStore.getAll() : [],
      setAll(cookiesToSet) {
        if (!acceptSession) return;
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot always write cookies; proxy.ts owns refresh.
        }
      }
    }
  });
}

export function createWorkspaceBearerClient(accessToken: string): SupabaseClient<any, any, any, any, any> {
  const { url, key, schema } = publicConfiguration();
  return createClient(url, key, {
    db: { schema },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

export function workspaceSupabaseUrl() {
  return publicConfiguration().url;
}
