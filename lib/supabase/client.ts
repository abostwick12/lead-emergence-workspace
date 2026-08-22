"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient<any, any, any, any, any> | undefined;

function configuration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error("Workspace is not configured. Set the public Supabase URL and anon key.");
  }
  return { url, anonKey };
}

export function getWorkspaceClient(): SupabaseClient<any, any, any, any, any> {
  if (browserClient) return browserClient;
  const { url, anonKey } = configuration();
  browserClient = createBrowserClient(url, anonKey, {
    db: { schema: process.env.NEXT_PUBLIC_WORKSPACE_SCHEMA?.trim() || "workspace" },
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  });
  return browserClient;
}
